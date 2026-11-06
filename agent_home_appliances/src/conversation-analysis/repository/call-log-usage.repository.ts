import { getConversationAnalysisConnection } from '../mongo/connection.js';
import type { ModelUsageTotal } from '../../common/llm-usage/types.js';

/**
 * Records the post-call analysis's LLM usage on the gateway's call log, next
 * to the live-call usage the gateway writes when the call ends. Only this
 * one field is set, so it never overwrites the gateway's part (whichever
 * finishes first). Studio turns the usage into a cost.
 */
export async function recordAnalysisUsage(callId: string, usage: ModelUsageTotal[]): Promise<void> {
  if (usage.length === 0) return;
  const connection = await getConversationAnalysisConnection();
  await connection.collection<{ _id: string }>('call_logs').updateOne(
    { _id: callId },
    {
      $set: {
        'usage.analysis_llm': usage.map((u) => ({
          model: u.model,
          input_tokens: u.inputTokens,
          output_tokens: u.outputTokens,
          calls: u.calls,
        })),
      },
    },
  );
}
