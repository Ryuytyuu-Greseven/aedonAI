import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallLog, CallLogDocument } from '../schemas/call-logs.schema';

/** A call log without its conversation, plus how many messages it holds. */
export type CallLogListRow = Omit<CallLog, 'call_conversation'> & {
  message_count: number;
};

@Injectable()
export class CallRecordsRepository {
  constructor(
    @InjectModel(CallLog.name)
    private readonly callLogModel: Model<CallLogDocument>,
  ) {}

  async filterByAgentId(agentId: string): Promise<CallLogDocument[]> {
    return this.callLogModel
      .find({ agent_id: agentId })
      .sort({ starting_time: -1 })
      .exec();
  }

  /** Newest first, transcripts left out — they can be long. */
  async listByAgentId(agentId: string): Promise<CallLogListRow[]> {
    return this.callLogModel
      .aggregate<CallLogListRow>([
        { $match: { agent_id: agentId } },
        { $sort: { starting_time: -1 } },
        {
          $addFields: {
            message_count: {
              $size: { $ifNull: ['$call_conversation', []] },
            },
          },
        },
        { $project: { call_conversation: 0 } },
      ])
      .exec();
  }

  async findOneForAgent(
    callId: string,
    agentId: string,
  ): Promise<CallLog | null> {
    return this.callLogModel
      .findOne({ _id: callId, agent_id: agentId })
      .lean<CallLog>()
      .exec();
  }

  async filterByAgentIdSince(
    agentId: string,
    since: Date,
  ): Promise<CallLogDocument[]> {
    return this.callLogModel
      .find({ agent_id: agentId, starting_time: { $gte: since } })
      .exec();
  }
}
