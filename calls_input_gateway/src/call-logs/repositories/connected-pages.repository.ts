import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectedPage,
  ConnectedPageDocument,
} from '../schemas/connected-pages.schema';

/**
 * Read-only — this collection is owned by lyreai_agent_builder_server /
 * meta-adapter (see connected-pages.schema.ts's doc comment); this repo
 * only ever looks it up, never writes to it.
 */
@Injectable()
export class ConnectedPagesRepository {
  constructor(
    @InjectModel(ConnectedPage.name)
    private readonly connectedPageModel: Model<ConnectedPageDocument>,
  ) {}

  async findByAgentId(agentId: string): Promise<ConnectedPageDocument[]> {
    return this.connectedPageModel.find({ agentId }).exec();
  }
}
