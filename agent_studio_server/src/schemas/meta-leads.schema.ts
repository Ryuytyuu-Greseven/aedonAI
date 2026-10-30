import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class CallAttempt {
  @Prop({ required: true })
  callId: string;

  @Prop({ required: true, default: () => new Date() })
  attemptedAt: Date;

  /** Agent (agents._id) that placed this call; absent on older attempts. */
  @Prop()
  agentId?: string;

  /** How it ended, reported by the carrier; anything not answered is 'missed'. */
  @Prop({ type: String, enum: ['answered', 'missed'] })
  outcome?: 'answered' | 'missed';

  /** Carrier's raw final status, e.g. 'no-answer'. */
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

  // The fields below are written by meta-adapter's call cron / manual call
  // endpoint and mirrored here so the leads page can show call state.

  /** Unset = never picked up; 'dialing' | 'initiated' | 'failed' | 'skipped'. */
  @Prop({ type: String })
  callStatus?: 'dialing' | 'initiated' | 'failed' | 'skipped';

  @Prop()
  lastCallError?: string;

  /** Agent (agents._id) that last handled this lead. */
  @Prop()
  agentId?: string;

  /** Outcome of the latest reported call. */
  @Prop({ type: String, enum: ['answered', 'missed'] })
  lastCallOutcome?: 'answered' | 'missed';

  /** When meta-adapter will retry a missed call; unset when none is scheduled. */
  @Prop()
  nextCallAt?: Date;
}

export const MetaLeadSchema = SchemaFactory.createForClass(MetaLead);

MetaLeadSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
