import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { LeadSource, ScheduledCall } from '../schemas/scheduled-call.schema';

export type NewScheduledCall = Pick<
  ScheduledCall,
  'customerId' | 'agentId' | 'leadSource' | 'leadKey' | 'phoneNumber' | 'reason' | 'attempt' | 'afterCallId' | 'dueAt'
>;

@Injectable()
export class ScheduledCallsRepository {
  constructor(@InjectModel(ScheduledCall.name) private readonly scheduledCallModel: Model<ScheduledCall>) {}

  /** Replaces the lead's pending call (if any) with this one. */
  async schedule(call: NewScheduledCall): Promise<void> {
    await this.cancelPendingForLead(call.leadSource, call.leadKey, 'Replaced by a newer schedule');
    await this.scheduledCallModel.create({ ...call, status: 'pending' });
  }

  async cancelPendingForLead(leadSource: LeadSource, leadKey: string, note: string): Promise<void> {
    await this.scheduledCallModel.updateMany(
      { leadSource, leadKey, status: 'pending' },
      { $set: { status: 'cancelled', note } },
    );
  }

  /** Cancels one of a company's pending calls; null when it isn't pending (or isn't theirs). */
  async cancelPendingForCustomer(id: string, customerId: string, note: string): Promise<ScheduledCall | null> {
    if (!isValidObjectId(id)) return null;
    return this.scheduledCallModel.findOneAndUpdate(
      { _id: id, customerId, status: 'pending' },
      { $set: { status: 'cancelled', note } },
      { new: true },
    );
  }

  /** Atomically claims the earliest due call so overlapping runs never place it twice. */
  async claimNextDue(now: Date): Promise<ScheduledCall | null> {
    return this.scheduledCallModel.findOneAndUpdate(
      { status: 'pending', dueAt: { $lte: now } },
      { $set: { status: 'dialing' } },
      { sort: { dueAt: 1 }, new: true },
    );
  }

  /** Puts a claimed call back in the queue for later (e.g. outside calling hours). */
  async postpone(id: string, dueAt: Date): Promise<void> {
    await this.scheduledCallModel.updateOne({ _id: id }, { $set: { status: 'pending', dueAt } });
  }

  async finish(id: string, status: 'done' | 'failed' | 'cancelled', fields: { callId?: string; note?: string } = {}): Promise<void> {
    await this.scheduledCallModel.updateOne({ _id: id }, { $set: { status, ...fields } });
  }
}
