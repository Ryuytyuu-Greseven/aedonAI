import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { LlmExecutionRecord } from '../types.js';
import { LLM_USAGE_MONGOOSE_CONNECTION } from './connection.constants.js';
import { LlmExecution, LlmExecutionDocument } from './llm-execution.schema.js';

@Injectable()
export class LlmExecutionRepository {
  constructor(
    @InjectModel(LlmExecution.name, LLM_USAGE_MONGOOSE_CONNECTION)
    private readonly model: Model<LlmExecutionDocument>,
  ) {}

  async insert(record: LlmExecutionRecord): Promise<void> {
    await this.model.create(record);
  }
}
