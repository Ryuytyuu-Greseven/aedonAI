import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { LlmExecutionRecord } from '../types.js';
import { LLM_USAGE_MONGOOSE_CONNECTION } from './connection.constants.js';
import { ConversationUsage, ConversationUsageDocument } from './conversation-usage.schema.js';

@Injectable()
export class ConversationUsageRepository {
  constructor(
    @InjectModel(ConversationUsage.name, LLM_USAGE_MONGOOSE_CONNECTION)
    private readonly model: Model<ConversationUsageDocument>,
  ) {}

  async applyExecution(record: LlmExecutionRecord): Promise<void> {
    await this.model.updateOne(
      { _id: record.threadId },
      {
        $inc: {
          totalInputTokens: record.inputTokens,
          totalOutputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          llmCallCount: 1,
        },
        $min: { firstCallAt: record.createdAt },
        $max: { lastCallAt: record.createdAt },
        $setOnInsert: {
          service: record.service,
          sessionId: record.sessionId,
          customerId: record.customerId ?? null,
        },
      },
      { upsert: true },
    );
  }
}
