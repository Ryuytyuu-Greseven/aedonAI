import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AgentHistory,
  AgentHistoryDocument,
} from '../schemas/agent-history.schema';

@Injectable()
export class AgentHistoriesRepository {
  constructor(
    @InjectModel(AgentHistory.name)
    private readonly agentHistoryModel: Model<AgentHistoryDocument>,
  ) {}

  async create(data: Partial<AgentHistory>): Promise<AgentHistoryDocument> {
    return this.agentHistoryModel.create(data);
  }

  async existsBySourceAgentIdAndStageVersion(
    sourceAgentId: string,
    stageVersion: number,
  ): Promise<boolean> {
    const count = await this.agentHistoryModel
      .countDocuments({
        source_agent_id: sourceAgentId,
        stage_version: stageVersion,
      })
      .exec();
    return count > 0;
  }

  async filterBySourceAgentIdAndStageVersion(
    sourceAgentId: string,
    stageVersion: number,
  ): Promise<AgentHistoryDocument | null> {
    return this.agentHistoryModel
      .findOne({
        source_agent_id: sourceAgentId,
        stage_version: stageVersion,
      })
      .exec();
  }

  async filterBySourceAgentId(
    sourceAgentId: string,
  ): Promise<AgentHistoryDocument[]> {
    return this.agentHistoryModel
      .find({ source_agent_id: sourceAgentId })
      .sort({ stage_version: -1, created_at: -1 })
      .exec();
  }
}
