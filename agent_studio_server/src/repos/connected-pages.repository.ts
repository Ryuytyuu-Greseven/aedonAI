import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectedPage,
  ConnectedPageDocument,
} from '../schemas/connected-page.schema';

@Injectable()
export class ConnectedPagesRepository {
  constructor(
    @InjectModel(ConnectedPage.name)
    private readonly connectedPageModel: Model<ConnectedPageDocument>,
  ) {}

  async findByCustomerId(customerId: string): Promise<ConnectedPageDocument[]> {
    return this.connectedPageModel
      .find({ customerId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Page ids linked to this agent (an agent can have more than one Page
   * assigned). Includes disabled Pages — a Page being currently inactive
   * shouldn't hide leads it already brought in.
   */
  async findPageIdsByAgentId(
    customerId: string,
    agentId: string,
  ): Promise<string[]> {
    const pages = await this.connectedPageModel
      .find({ customerId, agentId }, { pageId: 1 })
      .exec();
    return pages.map((page) => page.pageId);
  }

  async setActiveByPageId(
    customerId: string,
    pageId: string,
    isActive: boolean,
  ): Promise<ConnectedPageDocument | null> {
    return this.connectedPageModel
      .findOneAndUpdate(
        { customerId, pageId },
        { $set: { isActive } },
        { new: true },
      )
      .exec();
  }

  /** Returns how many of the customer's pages were toggled. */
  async setActiveForAllByCustomerId(
    customerId: string,
    isActive: boolean,
  ): Promise<number> {
    const result = await this.connectedPageModel
      .updateMany({ customerId }, { $set: { isActive } })
      .exec();
    return result.modifiedCount;
  }

  /**
   * Permanently deletes every connected page for the customer (full
   * disconnect — there is no re-enable after this). Returns how many were
   * removed.
   */
  async deleteAllByCustomerId(customerId: string): Promise<number> {
    const result = await this.connectedPageModel
      .deleteMany({ customerId })
      .exec();
    return result.deletedCount;
  }

  async setAgentByPageId(
    customerId: string,
    pageId: string,
    agentId: string | null,
  ): Promise<ConnectedPageDocument | null> {
    return this.connectedPageModel
      .findOneAndUpdate(
        { customerId, pageId },
        { $set: { agentId } },
        { new: true },
      )
      .exec();
  }
}
