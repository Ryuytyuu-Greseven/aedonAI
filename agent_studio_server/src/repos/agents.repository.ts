import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Agent, AgentDocument } from '../schemas/agent.schema';
import { LiveAgentsRepository } from './live-agents.repository';

@Injectable()
export class AgentsRepository {
  constructor(
    @InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>,
    private readonly liveAgentsRepository: LiveAgentsRepository,
  ) { }

  async create(data: Partial<Agent>): Promise<AgentDocument> {
    return this.agentModel.create(data);
  }

  async update(
    id: string,
    partial: UpdateQuery<AgentDocument>,
  ): Promise<AgentDocument | null> {
    return this.agentModel
      .findByIdAndUpdate(id, partial, { new: true })
      .exec();
  }

  async deleteById(id: string): Promise<AgentDocument | null> {
    return this.agentModel.findByIdAndDelete(id).exec();
  }

  async filterById(id: string): Promise<AgentDocument | null> {
    return this.agentModel.findById(id).exec();
  }

  async filterByAgentId(agentId: string): Promise<AgentDocument | null> {
    return this.agentModel.findOne({ agent_id: agentId }).exec();
  }

  async filterAll(companyId: string | null): Promise<AgentDocument[]> {
    return this.agentModel
      .find({ companyId })
      .sort({ created_at: -1 })
      .exec();
  }

  async filterByNameRegex(
    regex: RegExp,
  ): Promise<Pick<Agent, 'agent_name'>[]> {
    return this.agentModel
      .find({ agent_name: regex })
      .select('agent_name')
      .lean()
      .exec();
  }

  /** Counts live agents that reference this knowledge base id. */
  async countActiveByKnowledgeBaseId(knowledgeBaseId: string): Promise<number> {
    return this.liveAgentsRepository.countByKnowledgeBaseId(knowledgeBaseId);
  }
}
