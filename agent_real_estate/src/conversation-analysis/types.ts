// Public contract for this module. This is the ONLY thing the rest of the
// app (agent.gateway.ts) needs to import — everything else under
// src/conversation-analysis/ is self-contained and has zero imports from
// src/agent/**, so this whole directory can be lifted into a standalone
// server later with just its own entrypoint + the same MONGODB_URI /
// GEMINI_API_KEY env vars.

export type ConversationSpeaker = 'agent' | 'customer';

export interface ConversationTurn {
  speaker: ConversationSpeaker;
  text: string;
  timestamp: Date;
}

export interface EnqueueConversationInput {
  /** Stable id for this conversation — the graph's threadId. */
  conversationId: string;
  transcript: ConversationTurn[];
  agentId?: string | null;
  companyId?: string | null;
  customerId?: string | null;
  customerPhone?: string | null;
}
