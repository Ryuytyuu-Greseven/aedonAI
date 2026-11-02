import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  McpServer,
  McpServerSchema,
  ReferralBonus,
  ReferralBonusSchema,
} from './agent.schema';

export type LiveAgentDocument = HydratedDocument<LiveAgent>;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'live agents',
})
export class LiveAgent {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true, unique: true })
  agent_id: string;

  @Prop({ required: true })
  source_agent_document_id: string;

  @Prop({ required: true })
  agent_name: string;

  @Prop({ required: true, trim: true })
  country_code: string;

  @Prop({ type: String, default: null, trim: true })
  phone_number: string | null;

  /** `phone_numbers` id of the production number; null for agents that went live before numbers were linked. */
  @Prop({ type: String, default: null })
  phone_number_id: string | null;

  @Prop({ required: true, default: true })
  enable_voice: boolean;

  @Prop({ required: true, type: String, enum: ['live'], default: 'live' })
  status: 'live';

  @Prop({ default: [] })
  nodes: [];

  @Prop()
  base_template_id?: string;

  @Prop()
  greeting?: string;

  @Prop()
  behavior_prompt?: string;

  @Prop()
  behavior_notes?: string;

  @Prop({ type: ReferralBonusSchema })
  referral_bonus?: ReferralBonus;

  @Prop({ type: [String], default: [] })
  knowledge_base_ids: string[];

  @Prop({ type: [McpServerSchema], default: [] })
  mcp_servers: McpServer[];

  @Prop({ required: true })
  stage_version: number;

  @Prop({ type: Date, required: true })
  published_at: Date;

  /**
   * Ordered list of agent_histories document ids for previously published
   * live versions of this agent. Appended on each republish; never cleared.
   */
  @Prop({ type: [String], default: [] })
  previous_history_ids: string[];
}

export const LiveAgentSchema = SchemaFactory.createForClass(LiveAgent);
LiveAgentSchema.index({ knowledge_base_ids: 1 });

LiveAgentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
