import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  CallDirection,
  CallProvider,
  CallStatus,
  ConversationSpeaker,
} from '../interfaces/call-log.interface';

export const CALL_LOGS_COLLECTION = 'call_logs';

@Schema({ _id: false, versionKey: false })
export class CallConversationEntry {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({
    type: String,
    required: true,
    enum: ['customer', 'ai_agent', 'human_agent'],
  })
  speaker: ConversationSpeaker;

  @Prop({ type: String, default: null })
  human_agent_id?: string | null;

  @Prop({ type: [String], default: [] })
  intents?: string[];

  @Prop({ type: Date, required: true })
  timestamp: Date;
}
export const CallConversationEntrySchema = SchemaFactory.createForClass(
  CallConversationEntry,
);

@Schema({ _id: false, versionKey: false })
export class ConnectedHumanAgent {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  agent_id: string;

  @Prop({ type: Date, required: true })
  connected_time: Date;
}
export const ConnectedHumanAgentSchema =
  SchemaFactory.createForClass(ConnectedHumanAgent);

@Schema({ collection: CALL_LOGS_COLLECTION, versionKey: false })
export class CallLog {
  /** Provider call SID (Twilio CallSid / Exotel call sid) — used as the primary key. */
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true, enum: ['twilio', 'exotel', 'webrtc'] })
  provider: CallProvider;

  @Prop({ type: String, required: true, enum: ['inbound', 'outbound'] })
  direction: CallDirection;

  @Prop({
    type: String,
    required: true,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
  })
  status: CallStatus;

  @Prop({ type: Object, default: {} })
  customer_details: Record<string, unknown>;

  /** Customer's phone number — telephony (twilio/exotel) calls only. */
  @Prop({ type: String })
  phone_number?: string;

  /** Which agent template (business) this call was routed to. */
  @Prop({ type: String, required: true })
  agent_template_id: string;

  /**
   * Which agent *invocation* actually handled this call — a socket-supplied
   * id for webrtc/chat sessions; a fixed placeholder for twilio/exotel
   * calls until per-call agent invocation ids exist there too.
   */
  @Prop({ type: String, required: true })
  agent_id: string;

  /** Business's phone number — telephony (twilio/exotel) calls only. */
  @Prop({ type: String })
  agent_number?: string;

  @Prop({ type: String })
  call_summary?: string;

  @Prop({ type: [CallConversationEntrySchema], default: [] })
  call_conversation: CallConversationEntry[];

  @Prop({ type: [ConnectedHumanAgentSchema], default: [] })
  connected_human_agents: ConnectedHumanAgent[];

  @Prop({ type: Date, required: true })
  starting_time: Date;

  @Prop({ type: Date, default: null })
  ending_time: Date | null;

  @Prop({ type: Date, required: true })
  created_at: Date;

  @Prop({ type: Date, required: true })
  updated_at: Date;
}

export type CallLogDocument = HydratedDocument<CallLog>;
export const CallLogSchema = SchemaFactory.createForClass(CallLog);

// Recent calls for a given business/agent template, newest first.
CallLogSchema.index({ agent_template_id: 1, starting_time: -1 });
// Recent calls handled by a given agent invocation, newest first.
CallLogSchema.index({ agent_id: 1, starting_time: -1 });
// Call history for a given customer number, newest first.
CallLogSchema.index({ phone_number: 1, starting_time: -1 });
// Finding calls still in progress.
CallLogSchema.index({ status: 1 });
// Filtering inbound/outbound volume per provider.
CallLogSchema.index({ provider: 1, direction: 1 });
