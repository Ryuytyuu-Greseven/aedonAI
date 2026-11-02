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

  /**
   * Atomically claims the oldest uncalled lead (never dialed, has a phone
   * number, created after `createdAfter`) on one of the given Pages by
   * marking it 'dialing', so overlapping runs or instances never dial the
   * same lead twice.
   */
  async claimNextForCalling(pageIds: string[], createdAfter: Date): Promise<MetaLead | null> {
    return this.metaLeadModel.findOneAndUpdate(
      {
        pageId: { $in: pageIds },
        callStatus: { $exists: false },
        'callAttempts.0': { $exists: false },
        phoneNumber: { $nin: [null, ''] },
        metaCreatedAt: { $gte: createdAfter },
      },
      { $set: { callStatus: 'dialing' } },
      { sort: { metaCreatedAt: 1 }, new: true },
    );
  }

  /**
   * Claims one of a customer's leads for a user-triggered call: any status
   * except an in-flight 'dialing' or a 'skipped' lead, regardless of age or
   * earlier attempts.
   */
  async claimForManualCall(leadgenId: string, customerId: string): Promise<MetaLead | null> {
    return this.metaLeadModel.findOneAndUpdate(
      { leadgenId, customerId, callStatus: { $nin: ['dialing', 'skipped'] }, phoneNumber: { $nin: [null, ''] } },
      { $set: { callStatus: 'dialing' } },
      { new: true },
    );
  }

  async findByLeadgenIdForCustomer(leadgenId: string, customerId: string): Promise<MetaLead | null> {
    return this.metaLeadModel.findOne({ leadgenId, customerId }).exec();
  }

  async recordCallInitiated(leadgenId: string, callId: string, agentId: string): Promise<void> {
    await this.metaLeadModel.updateOne(
      { leadgenId },
      {
        $set: { callStatus: 'initiated', agentId },
        // A new call supersedes any scheduled retry (its job is dropped when due).
        $unset: { lastCallError: '', nextCallAt: '' },
        $push: { callAttempts: { callId, attemptedAt: new Date(), agentId } },
      },
    );
  }

  async recordCallFailed(leadgenId: string, error: string, agentId: string): Promise<void> {
    await this.metaLeadModel.updateOne(
      { leadgenId },
      { $set: { callStatus: 'failed', lastCallError: error, agentId } },
    );
  }

  /**
   * Records how a call ended on the attempt with this call id, once: a
   * repeated webhook finds the outcome already set and returns null, as does
   * a call id that isn't one of these leads' calls.
   */
  async recordCallOutcome(
    callId: string,
    outcome: 'answered' | 'missed',
    providerStatus: string,
  ): Promise<MetaLead | null> {
    return this.metaLeadModel.findOneAndUpdate(
      { callAttempts: { $elemMatch: { callId, outcome: { $exists: false } } } },
      {
        $set: {
          'callAttempts.$.outcome': outcome,
          'callAttempts.$.providerStatus': providerStatus,
          'callAttempts.$.endedAt': new Date(),
          lastCallOutcome: outcome,
        },
      },
      { new: true },
    );
  }

  async setNextCallAt(leadgenId: string, nextCallAt: Date | null): Promise<void> {
    await this.metaLeadModel.updateOne(
      { leadgenId },
      nextCallAt ? { $set: { nextCallAt } } : { $unset: { nextCallAt: '' } },
    );
  }

  /** Claims a lead for a scheduled call: any state but in-flight or skipped. */
  async claimForScheduledCall(leadgenId: string): Promise<MetaLead | null> {
    return this.metaLeadModel.findOneAndUpdate(
      { leadgenId, callStatus: { $nin: ['dialing', 'skipped'] }, phoneNumber: { $nin: [null, ''] } },
      { $set: { callStatus: 'dialing' } },
      { new: true },
    );
  }

  async findByLeadgenId(leadgenId: string): Promise<MetaLead | null> {
    return this.metaLeadModel.findOne({ leadgenId }).exec();
  }
}
