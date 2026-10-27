import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MetaLead } from '../schemas/meta-lead.schema';
import { UpsertMetaLeadInput } from '../common/interfaces/meta-lead.interface';

@Injectable()
export class MetaLeadsRepository {
  constructor(@InjectModel(MetaLead.name) private readonly metaLeadModel: Model<MetaLead>) {}

  async upsertByLeadgenId(input: UpsertMetaLeadInput): Promise<MetaLead> {
    return this.metaLeadModel.findOneAndUpdate(
      { leadgenId: input.leadgenId },
      { $set: input },
      { upsert: true, new: true },
    );
  }

  /**
   * Inserts the lead only if its leadgenId isn't stored yet; an existing
   * lead (e.g. already delivered by webhook, or with callAttempts written
   * by the dialer) is left untouched. Returns true when a new lead was inserted.
   */
  async insertIfNew(input: UpsertMetaLeadInput): Promise<boolean> {
    const result = await this.metaLeadModel.updateOne(
      { leadgenId: input.leadgenId },
      { $setOnInsert: input },
      { upsert: true },
    );
    return result.upsertedCount === 1;
  }

  async findByLeadgenId(leadgenId: string): Promise<MetaLead | null> {
    return this.metaLeadModel.findOne({ leadgenId }).exec();
  }
}
