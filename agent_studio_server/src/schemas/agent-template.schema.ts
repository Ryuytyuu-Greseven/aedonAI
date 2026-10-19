import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentTemplateDocument = HydratedDocument<AgentTemplate>;

@Schema({ timestamps: true, collection: 'agent_templates' })
export class AgentTemplate {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true, unique: true })
  template_id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  default_greeting: string;

  @Prop({ required: true })
  default_prompt: string;

  @Prop({ required: true })
  default_behavior: string;

  @Prop({ required: true, default: false })
  referral_bonus_eligible: boolean;

  @Prop({ required: true, default: false })
  status: boolean;
}

export const AgentTemplateSchema = SchemaFactory.createForClass(AgentTemplate);
