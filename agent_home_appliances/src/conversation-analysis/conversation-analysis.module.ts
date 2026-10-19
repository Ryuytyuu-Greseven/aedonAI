import { Injectable, Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as QueueRepo from './repository/analysis-queue.repository.js';
import { AnalysisWorker } from './worker/analysis-worker.js';
import { EnqueueConversationInput } from './types.js';

export * from './types.js';

/**
 * The single integration point the rest of the app is allowed to depend on.
 * Everything else in src/conversation-analysis/ (schemas, repositories, the
 * LLM analyzer, the worker loop) has zero imports from src/agent/** — when
 * this becomes its own server, the whole directory moves as-is behind a new
 * thin entrypoint, and this service's `enqueue` becomes an HTTP/queue call
 * instead of an in-process one.
 */
@Injectable()
export class ConversationAnalysisQueueService {
  enqueue(input: EnqueueConversationInput): Promise<void> {
    return QueueRepo.enqueue(input);
  }
}

@Module({
  providers: [ConversationAnalysisQueueService],
  exports: [ConversationAnalysisQueueService],
})
export class ConversationAnalysisModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConversationAnalysisModule.name);
  private readonly worker = new AnalysisWorker();

  onModuleInit(): void {
    this.worker.start();
    this.logger.log('Conversation analysis worker started');
  }

  onModuleDestroy(): void {
    this.worker.stop();
  }
}
