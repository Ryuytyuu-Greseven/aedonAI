import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallLog, CallLogDocument } from '../schemas/call-logs.schema';

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

  async filterByAgentIdSince(
    agentId: string,
    since: Date,
  ): Promise<CallLogDocument[]> {
    return this.callLogModel
      .find({ agent_id: agentId, starting_time: { $gte: since } })
      .exec();
  }
}
