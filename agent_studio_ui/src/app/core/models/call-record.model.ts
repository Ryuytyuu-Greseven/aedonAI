export type CallDirection = 'inbound' | 'outbound';
export type CallProvider = 'twilio' | 'exotel' | 'webrtc';
export type CallStatus = 'in_progress' | 'completed';

/** Estimated cost in USD (studio server prices the call's recorded usage). */
export interface CallCost {
  currency: 'USD';
  telephony: number;
  stt: number;
  tts: number;
  llm: number;
  analysis: number;
  total: number;
  total_inr: number;
  per_minute: number | null;
  /** Providers/models with no rate on file — counted as 0. */
  unpriced: string[];
}

export interface CallRecord {
  id: string;
  agent_id: string;
  provider: CallProvider;
  direction: CallDirection;
  status: CallStatus;
  occurred_at: string;
  ended_at: string | null;
  /** Null while the call is still in progress. */
  duration_seconds: number | null;
  /** Customer's number — null for web (playground) calls, which have none. */
  phone_number: string | null;
  customer_name: string | null;
  message_count: number;
  summary: string | null;
  /** Null while in progress, and for calls from before costs were recorded. */
  cost: CallCost | null;
}

/** `human` is a person who joined the call; `agent` is the AI agent. */
export type CallSpeaker = 'customer' | 'agent' | 'human';

export interface CallMessage {
  id: string;
  speaker: CallSpeaker;
  text: string;
  at: string;
}

export interface CallDetail extends CallRecord {
  messages: CallMessage[];
}

export interface DayCallStats {
  date: string;
  inbound: number;
  outbound: number;
}

export interface AgentCallStats {
  agentId: string;
  total: number;
  inbound: number;
  outbound: number;
  byDay: DayCallStats[];
}
