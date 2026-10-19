import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { CallRecordsRepository } from '../repos/call-records.repository';
import { CallLog } from '../schemas/call-logs.schema';

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

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly callRecordsRepository: CallRecordsRepository,
    private readonly agentsService: AgentsService,
  ) { }

  async getRecordsForAgent(agentId: string): Promise<CallLog[]> {
    const agentDetails = await this.agentsService.findById(agentId);
    return this.callRecordsRepository.filterByAgentId(agentDetails.agent_id);
  }

  async getStatsForAgent(agentId: string): Promise<AgentCallStats> {
    await this.agentsService.findById(agentId);

    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(windowStart.getDate() - (TRAILING_WINDOW_DAYS - 1));

    const records = await this.callRecordsRepository.filterByAgentIdSince(
      agentId,
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
