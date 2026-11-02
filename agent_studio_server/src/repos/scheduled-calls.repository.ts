import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScheduledCall } from '../schemas/scheduled-call.schema';

export type ScheduledCallsView = 'upcoming' | 'past';

@Injectable()
export class ScheduledCallsRepository {
  constructor(
    @InjectModel(ScheduledCall.name)
    private readonly scheduledCallModel: Model<ScheduledCall>,
  ) {}

  /**
   * Upcoming = pending or being dialed, soonest first; past = done, failed
   * or cancelled, latest first.
   */
  async findForAgent(
    customerId: string,
    agentId: string,
    view: ScheduledCallsView,
    page: number,
    limit: number,
  ): Promise<{ items: ScheduledCall[]; total: number }> {
    const upcoming = view === 'upcoming';
    const filter = {
      customerId,
      agentId,
      status: upcoming
        ? { $in: ['pending', 'dialing'] }
        : { $in: ['done', 'failed', 'cancelled'] },
    };
    const [items, total] = await Promise.all([
      this.scheduledCallModel
        .find(filter)
        .sort(upcoming ? { dueAt: 1 } : { updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ScheduledCall[]>()
        .exec(),
      this.scheduledCallModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
