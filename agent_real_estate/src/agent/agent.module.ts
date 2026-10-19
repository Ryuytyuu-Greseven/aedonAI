import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmUsageModule } from '../common/llm-usage/index.js';
import { AgentGateway } from './agent.gateway.js';
import { AgentService } from './agent.service.js';
import { CacheService } from '../common/cache/cache.service.js';
import { ConversationAnalysisModule } from '../conversation-analysis/index.js';

@Module({
  imports: [
    LlmUsageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        mongoUri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.get<string>('LLM_USAGE_DB_NAME'),
        serviceName: 'sales-agent',
      }),
    }),
    // Only integration point: AgentGateway injects
    // ConversationAnalysisQueueService to enqueue an ended call. Everything
    // else about how it's processed lives entirely inside that module.
    ConversationAnalysisModule,
  ],
  providers: [AgentGateway, AgentService, CacheService],
})
export class AgentModule { }
