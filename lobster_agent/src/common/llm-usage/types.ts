export interface LlmUsageContext {
  service: string;
  sessionId: string;
  threadId: string;
  customerId?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmExecutionRecord extends LlmUsageContext, TokenUsage {
  nodeName?: string;
  provider?: string;
  llmModel?: string;
  latencyMs: number;
  runId: string;
  parentRunId?: string;
  createdAt: Date;
}

export interface LlmUsageSink {
  recordExecution(record: LlmExecutionRecord): void;
}

export interface ConversationUsageRecord {
  _id: string;
  service: string;
  sessionId: string;
  customerId: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  llmCallCount: number;
  firstCallAt: Date;
  lastCallAt: Date;
}
