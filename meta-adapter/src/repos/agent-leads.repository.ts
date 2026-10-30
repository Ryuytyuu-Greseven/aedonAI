import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AgentLead } from '../schemas/agent-lead.schema';

const DUPLICATE_KEY = 11000;

export interface DialLeadInput {
  customerId: string;
  agentId: string;
  phoneNumber: string;
  fullName: string;
  leadDay: string;
}

/** Manual leads (`agent_leads`, source 'manual') — the call side of them. */
@Injectable()
export class AgentLeadsRepository {
  constructor(@InjectModel(AgentLead.name) private readonly agentLeadModel: Model<AgentLead>) {}

  /** Agents with at least one manual lead the cron could still dial. */
  async findAgentIdsWithPendingManualLeads(createdAfter: Date): Promise<string[]> {
    return this.agentLeadModel.distinct('agentId', this.pendingFilter(createdAfter)).exec();
  }

  /**
   * Atomically claims the oldest never-dialed manual lead of one of the
   * given agents by marking it 'dialing' — same rules as Meta leads.
   */
  async claimNextManualForCalling(agentIds: string[], createdAfter: Date): Promise<AgentLead | null> {
    return this.agentLeadModel.findOneAndUpdate(
      { ...this.pendingFilter(createdAfter), agentId: { $in: agentIds } },
      { $set: { callStatus: 'dialing' } },
      { sort: { leadCreatedAt: 1 }, new: true },
    );
  }

  /** Claims a company's manual lead for a user-triggered call (any state but in-flight or skipped). */
  async claimForManualCall(leadId: string, customerId: string): Promise<AgentLead | null> {
    return this.agentLeadModel.findOneAndUpdate(
      {
        leadId,
        customerId,
        source: 'manual',
        callStatus: { $nin: ['dialing', 'skipped'] },
        phoneNumber: { $nin: [null, ''] },
      },
      { $set: { callStatus: 'dialing' } },
      { new: true },
    );
  }

  async findManualForCustomer(leadId: string, customerId: string): Promise<AgentLead | null> {
    return this.agentLeadModel.findOne({ leadId, customerId, source: 'manual' }).exec();
  }

  /**
   * Stores a dialed number as today's manual lead, already claimed
   * ('dialing') so the cron can't dial it too. When today's lead for that
   * number exists it's claimed instead — null if a call to it is in flight.
   */
  async claimDialLead(input: DialLeadInput): Promise<AgentLead | null> {
    try {
      return await this.agentLeadModel.create({
        ...input,
        leadId: randomUUID(),
        source: 'manual',
        email: '',
        customFields: {},
        leadCreatedAt: new Date(),
        callStatus: 'dialing',
      });
    } catch (error) {
      if (error?.code !== DUPLICATE_KEY) throw error;
    }
    const claimed = await this.agentLeadModel.findOneAndUpdate(
      {
        agentId: input.agentId,
        phoneNumber: input.phoneNumber,
        leadDay: input.leadDay,
        source: 'manual',
        callStatus: { $nin: ['dialing', 'skipped'] },
      },
      { $set: { callStatus: 'dialing', ...(input.fullName ? { fullName: input.fullName } : {}) } },
      { new: true },
    );
    return claimed;
  }

  async recordCallInitiated(leadId: string, callId: string, agentId: string): Promise<void> {
    await this.agentLeadModel.updateOne(
      { leadId },
      {
        $set: { callStatus: 'initiated' },
        $unset: { lastCallError: '' },
        $push: { callAttempts: { callId, attemptedAt: new Date(), agentId } },
      },
    );
  }

  async recordCallFailed(leadId: string, error: string): Promise<void> {
    await this.agentLeadModel.updateOne({ leadId }, { $set: { callStatus: 'failed', lastCallError: error } });
  }

  private pendingFilter(createdAfter: Date) {
    return {
      source: 'manual',
      callStatus: { $exists: false },
      'callAttempts.0': { $exists: false },
      phoneNumber: { $nin: [null, ''] },
      leadCreatedAt: { $gte: createdAfter },
    };
  }
}
