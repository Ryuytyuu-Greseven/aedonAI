import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeadSource = 'meta' | 'manual';
export type ScheduledCallReason = 'missed_retry';
export type ScheduledCallStatus = 'pending' | 'dialing' | 'done' | 'failed' | 'cancelled';

/**
 * A call the dialer will place later, owned by meta-adapter. Today only
 * missed-call retries; customer-requested callbacks will land here too.
 * The lead mirrors `dueAt` as `nextCallAt` so the leads pages can show it.
 */
@Schema({ timestamps: true, collection: 'scheduled_calls' })
export class ScheduledCall extends Document {
  @Prop({ required: true })
  customerId: string;

  /** Agent (agents._id) that will place the call. */
  @Prop({ required: true })
  agentId: string;

  @Prop({ required: true, type: String, enum: ['meta', 'manual'] })
  leadSource: LeadSource;

  /** meta_leads.leadgenId or agent_leads.leadId. */
  @Prop({ required: true })
  leadKey: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ required: true, type: String, enum: ['missed_retry'] })
  reason: ScheduledCallReason;

  /** Retry number, 1-based (1 = first retry after the original call). */
  @Prop({ required: true })
  attempt: number;

  /** The missed call this follows; if the lead was called since, the job is dropped. */
  @Prop({ required: true })
  afterCallId: string;

  @Prop({ required: true })
  dueAt: Date;

  @Prop({ required: true, type: String, enum: ['pending', 'dialing', 'done', 'failed', 'cancelled'], default: 'pending' })
  status: ScheduledCallStatus;

  /** Provider call id once placed. */
  @Prop()
  callId?: string;

  /** Why it failed or was cancelled. */
  @Prop()
  note?: string;
}

export const ScheduledCallSchema = SchemaFactory.createForClass(ScheduledCall);

ScheduledCallSchema.index({ status: 1, dueAt: 1 });
// At most one pending call per lead.
ScheduledCallSchema.index(
  { leadSource: 1, leadKey: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
