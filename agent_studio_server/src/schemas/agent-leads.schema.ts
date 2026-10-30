import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CallAttempt, CallAttemptSchema } from './meta-leads.schema';

export type AgentLeadCallStatus =
  'dialing' | 'initiated' | 'failed' | 'skipped';

/**
 * Leads attributed directly to an agent, independent of the Meta pipeline
 * (`meta_leads`) — mirrors its shape, keyed by `agentId` instead of `pageId`.
 * Written by manual uploads / dials (`source: 'manual'`); meta-adapter's call
 * cron dials those and writes the call fields below.
 */
@Schema({ timestamps: true, collection: 'agent_leads' })
export class AgentLead extends Document {
  @Prop({ required: true, index: true })
  customerId: string;

  /** The agent this lead is attributed to — same id as Agent's Mongo `_id`. */
  @Prop({ required: true, index: true })
  agentId: string;

  @Prop({ required: true, unique: true, index: true })
  leadId: string;

  /** Where the lead came from, e.g. 'meta' | 'call' | 'manual'. */
  @Prop()
  source: string;

  @Prop()
  fullName: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop({ type: Object })
  customFields: Record<string, any>;

  /** When the lead was generated at its source, vs `createdAt` (row-insert time). */
  @Prop()
  leadCreatedAt: Date;

  /**
   * Manual leads only: the IST day (`YYYY-MM-DD`) it was added. The same
   * phone number can be added to an agent again on another day, not twice
   * on one day.
   */
  @Prop({ type: String })
  leadDay?: string;

  @Prop({ type: [CallAttemptSchema], default: [] })
  callAttempts: CallAttempt[];

  /** Unset = never picked up; same meaning as on `meta_leads`. */
  @Prop({ type: String, enum: ['dialing', 'initiated', 'failed', 'skipped'] })
  callStatus?: AgentLeadCallStatus;

  @Prop()
  lastCallError?: string;

  /** Outcome of the latest reported call. */
  @Prop({ type: String, enum: ['answered', 'missed'] })
  lastCallOutcome?: 'answered' | 'missed';

  /** When meta-adapter will retry a missed call; unset when none is scheduled. */
  @Prop()
  nextCallAt?: Date;
}

export const AgentLeadSchema = SchemaFactory.createForClass(AgentLead);

// One manual lead per agent + phone number + day; enforced here so
// concurrent uploads can't both insert it.
AgentLeadSchema.index(
  { agentId: 1, phoneNumber: 1, leadDay: 1 },
  { unique: true, partialFilterExpression: { source: 'manual' } },
);

AgentLeadSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
