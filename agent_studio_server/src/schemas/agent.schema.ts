import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

export type AgentStatus = 'draft' | 'staged' | 'live' | 'disabled';
export type ToolKind = 'custom' | 'api_webhook' | 'sms' | 'whatsapp' | 'email';
export type Currency = 'USD' | 'INR' | 'AED' | 'THB' | 'GBP' | 'EUR';

// @Schema({ _id: false })
// export class ToolParameter {
//   @Prop({ required: true })
//   name: string;

//   @Prop({ required: true })
//   type: string;

//   @Prop({ required: true })
//   description: string;

//   @Prop({ required: true, default: false })
//   required: boolean;
// }
// export const ToolParameterSchema = SchemaFactory.createForClass(ToolParameter);

// @Schema({ _id: false })
// export class DestinationConfig {
//   @Prop()
//   url?: string;

//   @Prop()
//   recipient?: string;
// }
// export const DestinationConfigSchema =
//   SchemaFactory.createForClass(DestinationConfig);

// @Schema({ _id: false })
// export class Tool {
//   @Prop({ required: true })
//   id: string;

//   @Prop({ required: true })
//   name: string;

//   @Prop({ required: true })
//   description: string;

//   @Prop({ type: [ToolParameterSchema], default: [] })
//   parameters: ToolParameter[];

//   @Prop()
//   returns?: string;

//   @Prop({
//     type: String,
//     enum: ['custom', 'api_webhook', 'sms', 'whatsapp', 'email'],
//     default: 'custom',
//   })
//   kind?: ToolKind;

//   @Prop({ type: DestinationConfigSchema })
//   destinationConfig?: DestinationConfig;
// }
// export const ToolSchema = SchemaFactory.createForClass(Tool);

// @Schema({ _id: false })
// export class NodePosition {
//   @Prop({ required: true })
//   x: number;

//   @Prop({ required: true })
//   y: number;
// }
// export const NodePositionSchema = SchemaFactory.createForClass(NodePosition);

// @Schema({ _id: false })
// export class AgentNode {
//   @Prop({ required: true })
//   id: string;

//   @Prop({ required: true })
//   name: string;

//   @Prop({ type: [String], default: [] })
//   tools: string[];

//   @Prop({ required: true })
//   prompt: string;

//   @Prop()
//   nextNode?: string;

//   @Prop()
//   previousNode?: string;

//   @Prop({ type: NodePositionSchema })
//   position?: NodePosition;
// }
// export const AgentNodeSchema = SchemaFactory.createForClass(AgentNode);

@Schema({ _id: false })
export class ReferralBonus {
  @Prop({ required: true })
  amount: number;

  @Prop({
    required: true,
    type: String,
    enum: ['USD', 'INR', 'AED', 'THB', 'GBP', 'EUR'],
  })
  currency: Currency;
}
export const ReferralBonusSchema = SchemaFactory.createForClass(ReferralBonus);

/** Missed calls a lead can be retried after; 0 = never retried. */
export const MAX_MISSED_CALL_RETRIES = 4;

/**
 * When the outbound dialer may call for this agent. Read by meta-adapter's
 * call cron; edited on its own (PATCH /agents/:id/call-settings) so a live
 * agent can change it without going back to draft.
 */
@Schema({ _id: false })
export class CallSettings {
  /** IANA zone the calling hours (and callback times) are in — not tied to the phone number's country. */
  @Prop({ required: true, default: 'Asia/Kolkata' })
  timezone: string;

  /** `HH:mm`, local to `timezone`. Automatic calls only start inside [start, end). */
  @Prop({ required: true, default: '09:00' })
  calling_hours_start: string;

  @Prop({ required: true, default: '18:00' })
  calling_hours_end: string;

  /** 0–MAX_MISSED_CALL_RETRIES. */
  @Prop({ required: true, default: 0 })
  missed_call_retries: number;

  @Prop({ required: true, default: 360 })
  missed_call_retry_gap_minutes: number;
}
export const CallSettingsSchema = SchemaFactory.createForClass(CallSettings);

@Schema({ _id: false })
export class McpServer {
  @Prop({ required: true, trim: true })
  server_name: string;

  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ required: true })
  api_key: string;
}
export const McpServerSchema = SchemaFactory.createForClass(McpServer);

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'agents',
})
export class Agent {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true })
  agent_name: string;

  @Prop({ required: true })
  agent_id: string;

  @Prop({ required: true, trim: true })
  country_code: string;

  @Prop({ required: true, default: 'te' })
  language: string;

  /** Provider-neutral voice code (female_1, male_1, …) — see agents/agent-voices.ts. */
  @Prop({ type: String, default: null })
  voice: string | null;

  @Prop({ type: String, default: null, trim: true })
  phone_number: string | null;

  @Prop({ required: true, default: true })
  enable_voice: boolean;

  @Prop({
    required: true,
    type: String,
    enum: ['draft', 'staged', 'live', 'disabled'],
    default: 'draft',
  })
  status: AgentStatus;

  @Prop({ default: [] })
  nodes: [];

  // @Prop({ type: [ToolSchema], default: [] })
  // tools: Tool[];

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

  @Prop({ type: CallSettingsSchema, default: () => ({}) })
  call_settings: CallSettings;

  /** Knowledge bases this agent can access (canonical link ownership). */
  @Prop({ type: [String], default: [] })
  knowledge_base_ids: string[];

  /** MCP servers this agent can use for tool execution. */
  @Prop({ type: [McpServerSchema], default: [] })
  mcp_servers: McpServer[];

  /**
   * Hash of {greeting, prompt, behavior, tools} as of the last successful
   * preview call. "Go Live" (staged -> live) compares this against a
   * freshly computed hash of the current fields and rejects with 409 if
   * they've drifted, so a stale preview can never authorize a live agent.
   * See backend-openspec/specs/agents/spec.md "Go Live requires a preview".
   */
  @Prop({ type: String, default: null })
  preview_hash: string | null;

  @Prop({ type: Number, default: 0 })
  current_stage_version: number;

  @Prop({ type: Date, default: null })
  staged_at: Date | null;

  @Prop({ type: Date, default: null })
  live_at: Date | null;

  // Internal bookkeeping for atomic clone-name generation. Never exposed in
  // API responses. See AgentsService.cloneAgent.
  @Prop({ type: String, select: false })
  clone_base_name?: string;

  @Prop({ type: Number, select: false })
  clone_number?: number;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
AgentSchema.index(
  { clone_base_name: 1, clone_number: 1 },
  {
    unique: true,
    partialFilterExpression: { clone_base_name: { $exists: true } },
  },
);
AgentSchema.index({ knowledge_base_ids: 1 });

AgentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.clone_base_name;
    delete ret.clone_number;
    return ret;
  },
});
