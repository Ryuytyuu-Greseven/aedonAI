import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ReportFrequency,
  ReportFrequencyDocument,
  ReportFrequencyPreference,
} from '../schemas/report-frequency.schema';

@Injectable()
export class ReportFrequencyRepository {
  constructor(
    @InjectModel(ReportFrequencyPreference.name)
    private readonly frequencyModel: Model<ReportFrequencyDocument>,
  ) {}

  async filterByAgentId(
    agentId: string,
  ): Promise<ReportFrequencyDocument | null> {
    return this.frequencyModel.findOne({ agent_id: agentId }).exec();
  }

  async upsertByAgentId(
    agentId: string,
    frequency: ReportFrequency,
  ): Promise<void> {
    await this.frequencyModel.updateOne(
      { agent_id: agentId },
      { agent_id: agentId, frequency },
      { upsert: true },
    );
  }
}
