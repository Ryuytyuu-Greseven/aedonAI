import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import { extractTokenUsage } from './extract-usage.js';
import { LlmUsageContext, LlmUsageSink } from './types.js';

interface RunInfo {
  nodeName?: string;
  provider?: string;
  llmModel?: string;
  startedAt: number;
}

// Attach one instance per graph invocation (per turn) via
// `{ callbacks: [handler] }`. LangGraph forwards callbacks to every node's
// LLM call, so this captures every execution in the run without touching
// individual node code.
export class TokenUsageCallbackHandler extends BaseCallbackHandler {
  name = 'TokenUsageCallbackHandler';

  private readonly runs = new Map<string, RunInfo>();

  constructor(
    private readonly context: LlmUsageContext,
    private readonly sink: LlmUsageSink,
  ) {
    super();
  }

  async handleLLMStart(
    llm: Serialized,
    _prompts: string[],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const serializedId = 'id' in llm ? llm.id : undefined;
    this.runs.set(runId, {
      nodeName: metadata?.langgraph_node as string | undefined,
      provider: (metadata?.ls_provider as string | undefined) ?? serializedId?.at(-1),
      llmModel: metadata?.ls_model_name as string | undefined,
      startedAt: Date.now(),
    });
  }

  async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string): Promise<void> {
    const info = this.runs.get(runId);
    this.runs.delete(runId);

    const usage = extractTokenUsage(output);
    if (!usage) return;

    this.sink.recordExecution({
      ...this.context,
      ...usage,
      nodeName: info?.nodeName,
      provider: info?.provider,
      llmModel: info?.llmModel,
      latencyMs: info ? Date.now() - info.startedAt : 0,
      runId,
      parentRunId,
      createdAt: new Date(),
    });
  }

  async handleLLMError(_err: Error, runId: string): Promise<void> {
    this.runs.delete(runId);
  }
}
