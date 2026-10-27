import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConnectedPage } from '../schemas/connected-page.schema';
import { UpsertConnectedPageInput } from '../common/interfaces/connected-page.interface';

/**
 * ConnectedPage records are upsert-only and permanent: a Page's row is
 * updated in place on every re-link, but is never deleted — deactivate via
 * `isActive: false` if a page needs to stop receiving webhooks. There is
 * deliberately no delete method on this repository.
 */
@Injectable()
export class ConnectedPagesRepository {
  constructor(
    @InjectModel(ConnectedPage.name) private readonly connectedPageModel: Model<ConnectedPage>,
  ) {}

  async upsertByPageId(input: UpsertConnectedPageInput): Promise<ConnectedPage> {
    return this.connectedPageModel.findOneAndUpdate(
      { pageId: input.pageId },
      { $set: { ...input, isActive: input.isActive ?? true } },
      { upsert: true, new: true },
    );
  }

  async findActiveByPageId(pageId: string): Promise<ConnectedPage | null> {
    return this.connectedPageModel.findOne({ pageId, isActive: true }).exec();
  }

  async findAllActive(customerId?: string): Promise<ConnectedPage[]> {
    return this.connectedPageModel.find({ isActive: true, ...(customerId && { customerId }) }).exec();
  }

  async findAllActiveWithAgent(): Promise<ConnectedPage[]> {
    return this.connectedPageModel.find({ isActive: true, agentId: { $nin: [null, ''] } }).exec();
  }

  async setLastLeadSyncAt(pageId: string, syncedAt: Date): Promise<void> {
    await this.connectedPageModel.updateOne({ pageId }, { $set: { lastLeadSyncAt: syncedAt } }).exec();
  }
}
