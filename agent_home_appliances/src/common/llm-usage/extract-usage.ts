import type { LLMResult } from '@langchain/core/outputs';
import type { TokenUsage } from './types.js';

interface RawTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface RawUsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

// @langchain/core normalizes usage onto `llmOutput.tokenUsage` for any chat
// model (ChatOpenAI, ChatVertexAI) whose response sets `message.usage_metadata`.
// Falls back to reading usage_metadata directly for edge cases (e.g. a single
// generation where llmOutput wasn't populated).
export function extractTokenUsage(output: LLMResult): TokenUsage | null {
  const tokenUsage = output.llmOutput?.tokenUsage as RawTokenUsage | undefined;
  if (tokenUsage) {
    const inputTokens = tokenUsage.promptTokens ?? 0;
    const outputTokens = tokenUsage.completionTokens ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: tokenUsage.totalTokens ?? inputTokens + outputTokens,
    };
  }

  const usageMetadata = (output.generations?.[0]?.[0] as { message?: { usage_metadata?: RawUsageMetadata } })
    ?.message?.usage_metadata;
  if (usageMetadata) {
    const inputTokens = usageMetadata.input_tokens ?? 0;
    const outputTokens = usageMetadata.output_tokens ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: usageMetadata.total_tokens ?? inputTokens + outputTokens,
    };
  }

  return null;
}
