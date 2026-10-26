import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// One document per individual LLM call. Mirrors LlmExecutionRecord in ../types.ts.
@Schema({ collection: 'llm_executions' })
export class LlmExecution {
  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  threadId: string;

  @Prop({ type: String, default: null })
  customerId?: string | null;

  @Prop({ type: String, default: null })
  nodeName?: string | null;

  @Prop({ type: String, default: null })
  provider?: string | null;

  @Prop({ type: String, default: null })
  llmModel?: string | null;

  @Prop({ required: true, min: 0 })
  inputTokens: number;

  @Prop({ required: true, min: 0 })
  outputTokens: number;

  @Prop({ required: true, min: 0 })
  totalTokens: number;

  @Prop({ required: true, min: 0 })
  latencyMs: number;

  @Prop({ required: true })
  runId: string;

  @Prop({ type: String, default: null })
  parentRunId?: string | null;

  @Prop({ required: true })
  createdAt: Date;
}

export type LlmExecutionDocument = HydratedDocument<LlmExecution>;

export const LlmExecutionSchema = SchemaFactory.createForClass(LlmExecution);
LlmExecutionSchema.index({ threadId: 1, createdAt: 1 });
LlmExecutionSchema.index({ service: 1, createdAt: -1 });
