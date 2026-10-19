import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CallLogRepository } from '../repositories/call-log.repository';
import {
  CallLog,
  ConnectHumanAgentInput,
  CustomerDetails,
  LogConversationEntryInput,
  StartCallLogInput,
} from '../interfaces/call-log.interface';

@Injectable()
export class CallLogService {
  private readonly logger = new Logger(CallLogService.name);

  constructor(private readonly callLogRepository: CallLogRepository) {}

  async startCallLog(input: StartCallLogInput): Promise<void> {
    await this.callLogRepository.create(input);
    this.logger.log(
      `[CallLog] Started ${input.provider}/${input.direction} call ${input.callId} — agentTemplate=${input.agentTemplateId} agent=${input.agentId}`,
    );
  }

  async logMessage(
    callId: string,
    input: LogConversationEntryInput,
  ): Promise<void> {
    if (!input.message?.trim()) return;

    await this.callLogRepository.appendConversationEntry(callId, {
      id: randomUUID(),
      message: input.message.trim(),
      speaker: input.speaker,
      human_agent_id: input.humanAgentId ?? null,
      intents: input.intents ?? [],
      timestamp: new Date(),
    });
  }

  async connectHumanAgent(
    callId: string,
    input: ConnectHumanAgentInput,
  ): Promise<void> {
    await this.callLogRepository.appendConnectedHumanAgent(callId, {
      id: randomUUID(),
      agent_id: input.agentId,
      connected_time: new Date(),
    });
    this.logger.log(
      `[CallLog] Human agent ${input.agentId} connected to call ${callId}`,
    );
  }

  async updateCallSummary(callId: string, summary: string): Promise<void> {
    await this.callLogRepository.updateFields(callId, {
      call_summary: summary,
    });
  }

  async updateCustomerDetails(
    callId: string,
    details: CustomerDetails,
  ): Promise<void> {
    const existing = await this.callLogRepository.findById(callId);
    const merged = { ...(existing?.customer_details ?? {}), ...details };
    await this.callLogRepository.updateFields(callId, {
      customer_details: merged,
    });
  }

  async endCallLog(callId: string): Promise<void> {
    await this.callLogRepository.finalize(callId);
    this.logger.log(`[CallLog] Ended call ${callId}`);
  }

  async getCallLog(callId: string): Promise<CallLog | null> {
    return this.callLogRepository.findById(callId);
  }
}
