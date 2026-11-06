export type CallProvider = 'twilio' | 'exotel' | 'webrtc';
export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'in_progress' | 'completed';
export type ConversationSpeaker = 'customer' | 'ai_agent' | 'human_agent';

/**
 * Open-ended — only `name` is known today, but callers may attach any other
 * customer attribute as it becomes available (email, CRM id, etc).
 */
export interface CustomerDetails {
  name?: string;
  [key: string]: unknown;
}

export interface CallConversationEntry {
  id: string;
  message: string;
  speaker: ConversationSpeaker;
  human_agent_id?: string | null;
  intents?: string[];
  timestamp: Date;
}

export interface ConnectedHumanAgent {
  id: string;
  agent_id: string;
  connected_time: Date;
}

/** Usage the gateway records on a call log when the call ends (see calls_input_gateway). */
export interface SttUsage {
  provider: string;
  seconds: number;
}

export interface TtsUsage {
  provider: string;
  characters: number;
}

export interface LlmUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  calls: number;
}

export interface CallUsage {
  stt: SttUsage[];
  tts: TtsUsage[];
  llm: LlmUsage[];
  /** Set separately by the agent's post-call analysis. */
  analysis_llm?: LlmUsage[];
}

/** A call's estimated cost in USD, priced by monitoring/call-cost.ts. */
export interface CallCost {
  currency: 'USD';
  telephony: number;
  stt: number;
  tts: number;
  llm: number;
  analysis: number;
  total: number;
  total_inr: number;
  /** Null for zero-length calls. */
  per_minute: number | null;
  /** Providers/models with no rate on file — counted as 0. */
  unpriced: string[];
}

export interface CallLog {
  id: string;
  provider: CallProvider;
  direction: CallDirection;
  status: CallStatus;

  customer_details: CustomerDetails;
  phone_number: string;

  agent_id: string;
  agent_number: string;

  call_summary?: string;
  call_conversation: CallConversationEntry[];
  connected_human_agents: ConnectedHumanAgent[];
  usage?: CallUsage | null;

  starting_time: Date;
  ending_time: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StartCallLogInput {
  callId: string;
  provider: CallProvider;
  direction: CallDirection;
  phoneNumber: string;
  agentId: string;
  agentNumber: string;
  customerDetails?: CustomerDetails;
}

export interface LogConversationEntryInput {
  message: string;
  speaker: ConversationSpeaker;
  humanAgentId?: string | null;
  intents?: string[];
}

export interface ConnectHumanAgentInput {
  agentId: string;
}

/** One row of `GET /agents/:id/calls` — no transcript, so the list stays light. */
export interface CallSummary {
  id: string;
  agent_id: string;
  provider: CallProvider;
  direction: CallDirection;
  status: CallStatus;
  occurred_at: Date;
  ended_at: Date | null;
  /** Null while the call is still in progress. */
  duration_seconds: number | null;
  /** Customer's number — null for web calls, which have none. */
  phone_number: string | null;
  customer_name: string | null;
  message_count: number;
  summary: string | null;
  /** Null while in progress, and for calls from before usage was recorded. */
  cost: CallCost | null;
}

export interface CallTranscriptMessage {
  id: string;
  speaker: ConversationSpeaker;
  text: string;
  at: Date;
}

/** `GET /agents/:id/calls/:callId` — a call with its full conversation. */
export interface CallTranscript extends CallSummary {
  messages: CallTranscriptMessage[];
}
