export type CallDirection = 'inbound' | 'outbound';
export type CallProvider = 'twilio' | 'exotel' | 'webrtc';
export type CallStatus = 'in_progress' | 'completed';

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
