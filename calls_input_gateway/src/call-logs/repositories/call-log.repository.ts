import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallLog, CallLogDocument } from '../schemas/call-log.schema';
import {
  CallLog as CallLogInterface,
  CallConversationEntry,
  ConnectedHumanAgent,
  StartCallLogInput,
} from '../interfaces/call-log.interface';

@Injectable()
export class CallLogRepository {
  private readonly logger = new Logger(CallLogRepository.name);

  constructor(
    @InjectModel(CallLog.name)
    private readonly callLogModel: Model<CallLogDocument>,
  ) {}

  async create(input: StartCallLogInput): Promise<void> {
    const now = new Date();
    await this.callLogModel.create({
      _id: input.callId,
      provider: input.provider,
      direction: input.direction,
      status: 'in_progress',
      customer_details: input.customerDetails ?? {},
      phone_number: input.phoneNumber,
      agent_template_id: input.agentTemplateId,
      agent_id: input.agentId,
      agent_number: input.agentNumber,
      call_conversation: [],
      connected_human_agents: [],
      starting_time: now,
      ending_time: null,
      created_at: now,
      updated_at: now,
    });
  }

  async findById(callId: string): Promise<CallLogInterface | null> {
    const doc = await this.callLogModel.findById(callId).lean().exec();
    return doc ? this.toInterface(doc) : null;
  }

  /** Resolves false when no call log exists for `callId` (entry dropped). */
  async appendConversationEntry(
    callId: string,
    entry: CallConversationEntry,
  ): Promise<boolean> {
    const result = await this.callLogModel.updateOne(
      { _id: callId },
      {
        $push: { call_conversation: entry },
        $set: { updated_at: new Date() },
      },
    );
    return result.matchedCount > 0;
  }

  async appendConnectedHumanAgent(
    callId: string,
    agent: ConnectedHumanAgent,
  ): Promise<void> {
    await this.callLogModel.updateOne(
      { _id: callId },
      {
        $push: { connected_human_agents: agent },
        $set: { updated_at: new Date() },
      },
    );
  }

  async updateFields(
    callId: string,
    fields: Partial<CallLogInterface>,
  ): Promise<void> {
    const rest = { ...(fields as Record<string, unknown>) };
    delete rest.id;
    await this.callLogModel.updateOne(
      { _id: callId },
      { $set: { ...rest, updated_at: new Date() } },
    );
  }

  async finalize(callId: string): Promise<void> {
    const now = new Date();
    await this.callLogModel.updateOne(
      { _id: callId },
      { $set: { ending_time: now, status: 'completed', updated_at: now } },
    );
  }

  private toInterface(doc: CallLogDocument): CallLogInterface {
    return {
      id: doc._id,
      provider: doc.provider,
      direction: doc.direction,
      status: doc.status,
      customer_details: doc.customer_details ?? {},
      phone_number: doc.phone_number,
      agent_template_id: doc.agent_template_id,
      agent_id: doc.agent_id,
      agent_number: doc.agent_number,
      call_summary: doc.call_summary,
      call_conversation: doc.call_conversation ?? [],
      connected_human_agents: doc.connected_human_agents ?? [],
      starting_time: doc.starting_time,
      ending_time: doc.ending_time ?? null,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    };
  }
}
