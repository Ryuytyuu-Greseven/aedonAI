import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScheduledCallStatus =
  'pending' | 'dialing' | 'done' | 'failed' | 'cancelled';

/**
 * Read-only mirror of `scheduled_calls`, owned by meta-adapter (the dialer),
 * which also defines its indexes. Listed on the leads page; cancelling goes
 * through meta-adapter.
 */
@Schema({ timestamps: true, collection: 'scheduled_calls', autoIndex: false })
export class ScheduledCall extends Document {
  @Prop()
  customerId: string;

  @Prop()
  agentId: string;

  /** 'meta' (meta_leads.leadgenId) or 'manual' (agent_leads.leadId). */
  @Prop()
  leadSource: 'meta' | 'manual';

  @Prop()
  leadKey: string;

  @Prop()
  phoneNumber: string;

  /** Only 'missed_retry' so far. */
  @Prop()
  reason: string;

  /** Retry number, 1-based. */
  @Prop()
  attempt: number;

  @Prop()
  dueAt: Date;

  @Prop({ type: String })
  status: ScheduledCallStatus;

  @Prop()
  callId?: string;

  @Prop()
  note?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ScheduledCallSchema = SchemaFactory.createForClass(ScheduledCall);
