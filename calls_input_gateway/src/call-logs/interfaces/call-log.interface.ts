export type CallProvider = 'twilio' | 'exotel' | 'webrtc';
export type CallDirection = 'inbound' | 'outbound';
/**
 * Whether a session is real customer traffic or a playground preview —
 * forwarded to the domain agents so their stats can exclude previews.
 */
export type CallChannel = 'live' | 'preview';
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

export interface CallLog {
  id: string;
  provider: CallProvider;
  direction: CallDirection;
  status: CallStatus;

  customer_details: CustomerDetails;
  /** Customer's phone number — telephony (twilio/exotel) calls only. */
  phone_number?: string;

  /** Which agent template (business) this call was routed to. */
  agent_template_id: string;
  /**
   * Which agent invocation actually handled this call — socket-supplied for
   * webrtc/chat, a fixed placeholder for twilio/exotel today.
   */
  agent_id: string;
  /** Business's phone number — telephony (twilio/exotel) calls only. */
  agent_number?: string;

  call_summary?: string;
  call_conversation: CallConversationEntry[];
  connected_human_agents: ConnectedHumanAgent[];

  starting_time: Date;
  ending_time: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StartCallLogInput {
  callId: string;
  provider: CallProvider;
  direction: CallDirection;
  phoneNumber?: string;
  agentTemplateId: string;
  agentId: string;
  agentNumber?: string;
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
