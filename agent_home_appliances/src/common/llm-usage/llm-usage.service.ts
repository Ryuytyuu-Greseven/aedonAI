import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_USAGE_MODULE_OPTIONS } from './llm-usage.constants.js';
import type { LlmUsageModuleOptions } from './llm-usage.module-options.js';
import { ConversationUsageRepository, LlmExecutionRepository } from './mongodb/index.js';
import { TokenUsageCallbackHandler } from './token-usage.callback.js';
import type { LlmExecutionRecord, LlmUsageContext } from './types.js';

@Injectable()
export class LlmUsageService {
  private readonly logger = new Logger(LlmUsageService.name);

  constructor(
    @Inject(LLM_USAGE_MODULE_OPTIONS) private readonly options: LlmUsageModuleOptions,
    private readonly executionRepository: LlmExecutionRepository,
    private readonly conversationRepository: ConversationUsageRepository,
  ) {}

  // One tracker per graph invocation (per turn). Pass its handler via
  // `{ callbacks: [tracker] }` into `graph.stream()` / `graph.invoke()`.
  createTracker(context: Omit<LlmUsageContext, 'service'>): TokenUsageCallbackHandler {
    const fullContext: LlmUsageContext = { service: this.options.serviceName, ...context };
    return new TokenUsageCallbackHandler(fullContext, {
      recordExecution: (record) => this.recordExecution(record),
    });
  }

  private recordExecution(record: LlmExecutionRecord): void {
    this.executionRepository
      .insert(record)
      .catch((err: Error) => this.logger.error(`failed to record llm execution: ${err.message}`));

    this.conversationRepository
      .applyExecution(record)
      .catch((err: Error) => this.logger.error(`failed to update conversation usage: ${err.message}`));
  }
}
