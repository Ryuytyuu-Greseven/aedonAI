import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * One outbound call attempt against a lead. Written by the calling
 * microservice (not meta-adapter) each time it dials the lead's phone
 * number — callId is that system's call/session id, so a lead can be
 * retried (by the AI dialer or a human agent) without losing history.
 */
@Schema({ _id: false })
export class CallAttempt {
  @Prop({ required: true })
  callId: string;

  @Prop({ required: true, default: () => new Date() })
  attemptedAt: Date;
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
}

export const MetaLeadSchema = SchemaFactory.createForClass(MetaLead);
