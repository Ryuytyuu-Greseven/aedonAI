export type CallDirection = 'inbound' | 'outbound';
export type CallOutcome = 'lead' | 'no_answer' | 'completed';

export interface CallRecord {
  id: string;
  agent_id: string;
  direction: CallDirection;
  occurred_at: string;
  outcome: CallOutcome;
  duration_seconds: number;
  total_tokens: number;
  phone_number: string;
  customer_name: string | null;
  cost_usd: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type CallTimelineEvent =
  | {
      kind: 'message';
      id: string;
      speaker: 'agent' | 'customer';
      text: string;
      at: string;
      reasoning?: string;
      cost_usd: number;
    }
  | {
      kind: 'tool_execution';
      id: string;
      toolName: string;
      input: Record<string, unknown>;
      output: string;
      status: 'success' | 'error';
      durationMs: number;
      at: string;
    };

export interface CallDetail {
  callId: string;
  agentId: string;
  timeline: CallTimelineEvent[];
  tokenUsage: TokenUsage;
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
