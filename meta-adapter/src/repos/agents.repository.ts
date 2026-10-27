import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Agent, AgentDocument } from '../schemas/agent.schema';

@Injectable()
export class AgentsRepository {
  constructor(@InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>) {}

  /** Looks up by Mongo _id — what agent_studio_server stores as a ConnectedPage's agentId. */
  async findById(id: string): Promise<AgentDocument | null> {
    if (!isValidObjectId(id)) return null;
    return this.agentModel.findById(id).exec();
  }
}
