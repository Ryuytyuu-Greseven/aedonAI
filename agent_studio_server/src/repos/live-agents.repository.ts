import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LiveAgent, LiveAgentDocument } from '../schemas/live-agent.schema';

@Injectable()
export class LiveAgentsRepository {
  constructor(
    @InjectModel(LiveAgent.name)
    private readonly liveAgentModel: Model<LiveAgentDocument>,
  ) {}

  async filterByAgentId(agentId: string): Promise<LiveAgentDocument | null> {
    return this.liveAgentModel.findOne({ agent_id: agentId }).exec();
  }

  /**
   * Updates the existing live agent for `agentId`, or creates one on first
   * publish. When `previousHistoryId` is provided, appends it to
   * `previous_history_ids` (no duplicates).
   */
  async publishByAgentId(
    agentId: string,
    data: Partial<LiveAgent>,
    previousHistoryId?: string,
  ): Promise<LiveAgentDocument | null> {
    const update: Record<string, unknown> = { $set: data };
    if (previousHistoryId) {
      update.$addToSet = { previous_history_ids: previousHistoryId };
    }

    return this.liveAgentModel
      .findOneAndUpdate({ agent_id: agentId }, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec();
  }

  async filterAll(companyId: string | null): Promise<LiveAgentDocument[]> {
    return this.liveAgentModel
      .find({ companyId })
      .sort({ published_at: -1 })
      .exec();
  }

  async countByKnowledgeBaseId(knowledgeBaseId: string): Promise<number> {
    return this.liveAgentModel
      .countDocuments({ knowledge_base_ids: knowledgeBaseId })
      .exec();
  }
}
