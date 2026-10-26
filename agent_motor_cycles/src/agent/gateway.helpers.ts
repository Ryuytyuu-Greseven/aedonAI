import { ConversationTurn } from '../conversation-analysis/index.js';
import { CONVERSATION_START, FillerMemory } from './graphs/sales/filler/filler-controller.js';

export interface LiveSession {
  conversationId: string | null;
  agentId: string | null;
  companyId: string | null;
  customerId: string | null;
  customerPhone: string | null;
  callId: string | null;
  channel: 'live' | 'preview' | null;
  transcript: ConversationTurn[];
  fillerMemory: FillerMemory;
}

/** Carries forward call/agent identifiers from each incoming message onto the session. */
export function syncSessionDetails(session: LiveSession, msg: any): void {
  session.conversationId = msg.threadId ?? session.conversationId;
  session.agentId = msg.agentDetails?.id ?? msg.agentDetails?.agent_id ?? session.agentId;
  session.companyId = msg.agentDetails?.companyId ?? session.companyId;
  session.customerId = msg.customerId ?? session.customerId;
  session.customerPhone = msg.customerPhNo || session.customerPhone;
  session.callId = msg.callId ?? session.callId;
  session.channel = msg.channel ?? session.channel;
}

export function recordCustomerTurn(session: LiveSession, text: unknown): void {
  // The sentinel that kicks off the greeting isn't something the
  // customer actually said — keep it out of the transcript.
  if (typeof text === 'string' && text !== CONVERSATION_START) {
    session.transcript.push({ speaker: 'customer', text, timestamp: new Date() });
  }
}
