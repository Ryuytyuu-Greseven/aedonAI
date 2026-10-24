import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import type {
  CallSummary,
  CallTranscript,
} from '../common/interfaces/call-logs.interface';
import { CallRecordsRepository } from '../repos/call-records.repository';
import { CallLog } from '../schemas/call-logs.schema';
import { toCallSummary, toCallTranscript } from './call-log.mapper';

export interface DayCallStats {
  date: string;
  inbound: number;
  outbound: number;
}

export interface AgentCallStats {
  agentId: string;
  total: number;
  inbound: number;
  outbound: number;
  byDay: DayCallStats[];
}

const TRAILING_WINDOW_DAYS = 14;

// A call log stays `in_progress` if the gateway dies before closing it, so
// anything older than this is treated as stale rather than active. Phone
// calls are auto-hung-up at 2 minutes; this leaves room for web calls.
const ACTIVE_CALL_MAX_AGE_MS = 10 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly callRecordsRepository: CallRecordsRepository,
    private readonly agentsService: AgentsService,
  ) {}

  /** Raw call log documents — used by Reporting's export. */
  async getRecordsForAgent(agentId: string): Promise<CallLog[]> {
    const agentDetails = await this.agentsService.findById(agentId);
    return this.callRecordsRepository.filterByAgentId(agentDetails.agent_id);
  }

  async listCallsForAgent(
    agentId: string,
    companyId: string | null,
  ): Promise<CallSummary[]> {
    const agent = await this.agentsService.findById(agentId, companyId);
    const rows = await this.callRecordsRepository.listByAgentId(agent.agent_id);
    return rows.map(toCallSummary);
  }

  async listActiveCallsForAgent(
    agentId: string,
    companyId: string | null,
  ): Promise<CallSummary[]> {
    const agent = await this.agentsService.findById(agentId, companyId);
    const rows = await this.callRecordsRepository.listActiveByAgentId(
      agent.agent_id,
      new Date(Date.now() - ACTIVE_CALL_MAX_AGE_MS),
    );
    return rows.map(toCallSummary);
  }

  async getCallTranscript(
    agentId: string,
    callId: string,
    companyId: string | null,
  ): Promise<CallTranscript> {
    const agent = await this.agentsService.findById(agentId, companyId);
    const log = await this.callRecordsRepository.findOneForAgent(
      callId,
      agent.agent_id,
    );
    if (!log) throw new NotFoundException(`Call ${callId} not found`);
    return toCallTranscript(log);
  }

  async getStatsForAgent(
    agentId: string,
    companyId?: string | null,
  ): Promise<AgentCallStats> {
    const agent = await this.agentsService.findById(agentId, companyId);

    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(windowStart.getDate() - (TRAILING_WINDOW_DAYS - 1));

    // call_logs are keyed by the agent's agent_id, not its Mongo _id.
    const records = await this.callRecordsRepository.filterByAgentIdSince(
      agent.agent_id,
      windowStart,
    );

    const byDayMap = new Map<string, DayCallStats>();
    for (let i = 0; i < TRAILING_WINDOW_DAYS; i++) {
      const date = new Date(windowStart);
      date.setDate(date.getDate() + i);
      const key = toDateKey(date);
      byDayMap.set(key, { date: key, inbound: 0, outbound: 0 });
    }

    let inbound = 0;
    let outbound = 0;
    for (const record of records) {
      const key = toDateKey(record.starting_time);
      const bucket = byDayMap.get(key);
      if (record.direction === 'inbound') {
        inbound++;
        if (bucket) bucket.inbound++;
      } else {
        outbound++;
        if (bucket) bucket.outbound++;
      }
    }

    return {
      agentId,
      total: inbound + outbound,
      inbound,
      outbound,
      byDay: Array.from(byDayMap.values()),
    };
  }
}
