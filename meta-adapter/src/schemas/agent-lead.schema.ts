import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CallAttempt, CallAttemptSchema } from './meta-lead.schema';

/**
 * Mirror of `agent_leads`, owned by lyreai_agent_builder_server (which also
 * defines its indexes). meta-adapter dials the manual ones (`source:
 * 'manual'`) and writes only the call fields, plus the lead it stores when a
 * user dials a typed-in number.
 */
@Schema({ timestamps: true, collection: 'agent_leads', autoIndex: false })
export class AgentLead extends Document {
  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  agentId: string;

  @Prop({ required: true })
  leadId: string;

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

  @Prop()
  leadCreatedAt: Date;

  // IST day (YYYY-MM-DD) a manual lead was added; agent + phone + day is unique.
  @Prop()
  leadDay?: string;

  @Prop({ type: [CallAttemptSchema], default: [] })
  callAttempts: CallAttempt[];

  // Same meaning as on meta_leads: unset = not yet picked up.
  @Prop({ type: String, enum: ['dialing', 'initiated', 'failed', 'skipped'] })
  callStatus?: 'dialing' | 'initiated' | 'failed' | 'skipped';

  @Prop()
  lastCallError?: string;
}

export const AgentLeadSchema = SchemaFactory.createForClass(AgentLead);
