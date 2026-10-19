export type CallProvider = 'twilio' | 'exotel';
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
