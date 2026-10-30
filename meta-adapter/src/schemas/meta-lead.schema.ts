import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * One outbound call attempt against a lead. Written each time the lead's
 * phone number is dialed (by meta-adapter's call cron, or another dialer) —
 * callId is the telephony call id (e.g. Twilio CallSid), so a lead can be
 * retried (by the AI dialer or a human agent) without losing history.
 */
@Schema({ _id: false })
export class CallAttempt {
  @Prop({ required: true })
  callId: string;

  @Prop({ required: true, default: () => new Date() })
  attemptedAt: Date;

  // Agent (agents._id) that placed this call — kept per attempt since the
  // Page's linked agent can change between retries. Absent on older attempts.
  @Prop()
  agentId?: string;

  // How the call ended, reported by calls_input_gateway from the carrier's
  // status webhook: anything not answered (busy, no-answer, canceled,
  // failed) is 'missed'. Unset until reported.
  @Prop({ type: String, enum: ['answered', 'missed'] })
  outcome?: 'answered' | 'missed';

  // Carrier's raw final status, e.g. 'no-answer'.
  @Prop()
  providerStatus?: string;

  @Prop()
  endedAt?: Date;
}

export const CallAttemptSchema = SchemaFactory.createForClass(CallAttempt);

@Schema({ timestamps: true, collection: 'meta_leads' })
export class MetaLead extends Document {
  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, index: true })
  pageId: string;

  @Prop({ required: true, unique: true, index: true })
  leadgenId: string;

  @Prop()
  formId: string;

  @Prop()
  adId: string;

  @Prop()
  adgroupId: string;

  @Prop()
  fullName: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop({ type: Object })
  customFields: Record<string, any>;

  @Prop()
  metaCreatedAt: Date;

  @Prop({ type: [CallAttemptSchema], default: [] })
  callAttempts: CallAttempt[];

  // Agent (agents._id) that last handled this lead, stamped when the call
  // cron dials it (leads aren't tied to an agent when first stored).
  @Prop({ index: true })
  agentId?: string;

  // Set by the call cron: unset = not yet picked up, 'dialing' = claimed
  // and the gateway request is in flight, 'initiated' = gateway placed the
  // call, 'failed' = gateway rejected it (see lastCallError), 'skipped' =
  // excluded by hand (e.g. a test lead that must never be dialed).
  @Prop({ type: String, enum: ['dialing', 'initiated', 'failed', 'skipped'] })
  callStatus?: 'dialing' | 'initiated' | 'failed' | 'skipped';

  @Prop()
  lastCallError?: string;

  // Outcome of the latest reported call (see CallAttempt.outcome).
  @Prop({ type: String, enum: ['answered', 'missed'] })
  lastCallOutcome?: 'answered' | 'missed';

  // When a missed-call retry is scheduled (scheduled_calls); unset otherwise.
  @Prop()
  nextCallAt?: Date;
}

export const MetaLeadSchema = SchemaFactory.createForClass(MetaLead);
