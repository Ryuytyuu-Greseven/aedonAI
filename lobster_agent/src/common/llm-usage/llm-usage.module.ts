import { DynamicModule, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LLM_USAGE_MODULE_OPTIONS } from './llm-usage.constants.js';
import { LlmUsageModuleOptions } from './llm-usage.module-options.js';
import { LlmUsageService } from './llm-usage.service.js';
import {
  ConversationUsage,
  ConversationUsageRepository,
  ConversationUsageSchema,
  LLM_USAGE_MONGOOSE_CONNECTION,
  LlmExecution,
  LlmExecutionRepository,
  LlmExecutionSchema,
} from './mongodb/index.js';

interface LlmUsageModuleAsyncOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imports?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => LlmUsageModuleOptions | Promise<LlmUsageModuleOptions>;
}

@Global()
@Module({})
export class LlmUsageModule {
  static forRootAsync(options: LlmUsageModuleAsyncOptions): DynamicModule {
    return {
      module: LlmUsageModule,
      imports: [
        MongooseModule.forRootAsync({
          connectionName: LLM_USAGE_MONGOOSE_CONNECTION,
          imports: options.imports ?? [],
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const moduleOptions = await options.useFactory(...args);
            return { uri: moduleOptions.mongoUri, dbName: moduleOptions.dbName };
          },
        }),
        MongooseModule.forFeature(
          [
            { name: LlmExecution.name, schema: LlmExecutionSchema },
            { name: ConversationUsage.name, schema: ConversationUsageSchema },
          ],
          LLM_USAGE_MONGOOSE_CONNECTION,
        ),
      ],
      providers: [
        {
          provide: LLM_USAGE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        LlmExecutionRepository,
        ConversationUsageRepository,
        LlmUsageService,
      ],
      exports: [LlmUsageService],
    };
  }
}
