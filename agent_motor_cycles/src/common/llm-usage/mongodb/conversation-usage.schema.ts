import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// One document per conversation (`_id` = threadId), updated cumulatively on
// every LLM execution so reading a conversation's stats is O(1). Mirrors
// ConversationUsageRecord in ../types.ts.
@Schema({ collection: 'conversation_usage', _id: false })
export class ConversationUsage {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ type: String, default: null })
  customerId?: string | null;

  @Prop({ required: true, default: 0, min: 0 })
  totalInputTokens: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalOutputTokens: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalTokens: number;

  @Prop({ required: true, default: 0, min: 0 })
  llmCallCount: number;

  @Prop({ required: true })
  firstCallAt: Date;

  @Prop({ required: true })
  lastCallAt: Date;
}

export type ConversationUsageDocument = HydratedDocument<ConversationUsage>;

export const ConversationUsageSchema = SchemaFactory.createForClass(ConversationUsage);
ConversationUsageSchema.index({ service: 1, lastCallAt: -1 });
