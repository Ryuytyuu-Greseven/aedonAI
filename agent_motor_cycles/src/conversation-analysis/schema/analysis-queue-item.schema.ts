import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnalysisQueueStatus = 'pending' | 'processing' | 'done' | 'failed';

@Schema({ timestamps: false, collection: 'conversation_analysis_queue' })
export class AnalysisQueueItem extends Document {
  @Prop({ required: true, unique: true, index: true })
  conversationId: string;

  @Prop({ required: true, default: 'pending', index: true })
  status: AnalysisQueueStatus;

  @Prop({ type: [Object], required: true })
  transcript: { speaker: 'agent' | 'customer'; text: string; timestamp: Date }[];

  @Prop({ type: String, default: null })
  agentId: string | null;

  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ type: String, default: null })
  customerId: string | null;

  @Prop({ type: String, default: null })
  customerPhone: string | null;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ type: String, default: null })
  lastError: string | null;

  @Prop({ required: true })
  enqueuedAt: Date;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;
}

export const AnalysisQueueItemSchema = SchemaFactory.createForClass(AnalysisQueueItem);
