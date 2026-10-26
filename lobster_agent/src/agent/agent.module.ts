import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmUsageModule } from '../common/llm-usage/index.js';
import { AgentGateway } from './agent.gateway.js';
import { AgentService } from './agent.service.js';

@Module({
  imports: [
    LlmUsageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        mongoUri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.get<string>('LLM_USAGE_DB_NAME'),
        serviceName: 'lobster-agent',
      }),
    }),
  ],
  providers: [AgentGateway, AgentService],
})
export class AgentModule {}
