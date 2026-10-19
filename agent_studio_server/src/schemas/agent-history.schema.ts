import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  AgentStatus,
  McpServer,
  McpServerSchema,
  ReferralBonus,
  ReferralBonusSchema,
} from './agent.schema';

export type AgentHistoryDocument = HydratedDocument<AgentHistory>;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'agent_histories',
})
export class AgentHistory {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true })
  source_agent_id: string;

  @Prop({ required: true })
  source_agent_document_id: string;

  @Prop({ required: true })
  stage_version: number;

  @Prop({ required: true, type: String, enum: ['staged', 'live'] })
  snapshot_status: Extract<AgentStatus, 'staged' | 'live'>;

  @Prop({ required: true })
  agent_name: string;

  @Prop({ required: true, trim: true })
  country_code: string;

  @Prop({ type: String, default: null, trim: true })
  phone_number: string | null;

  @Prop({ required: true, default: true })
  enable_voice: boolean;

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

  @Prop({ type: Date, default: null })
  staged_at: Date | null;

  @Prop({ type: Date, default: null })
  live_at: Date | null;

  @Prop({ type: Date, required: true })
  archived_at: Date;
}

export const AgentHistorySchema = SchemaFactory.createForClass(AgentHistory);
AgentHistorySchema.index({ source_agent_id: 1, stage_version: -1 });

AgentHistorySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
