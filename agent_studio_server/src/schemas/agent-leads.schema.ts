import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Leads attributed directly to an agent (e.g. gathered via live calls),
 * independent of the Meta pipeline (`meta_leads`) — mirrors its shape,
 * keyed by `agentId` instead of `pageId`. Nothing writes to this collection
 * yet; only listing is implemented so far.
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
}

export const AgentLeadSchema = SchemaFactory.createForClass(AgentLead);

AgentLeadSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
