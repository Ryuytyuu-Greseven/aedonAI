import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false, collection: 'conversation_summaries' })
export class ConversationSummary extends Document {
  @Prop({ required: true, unique: true, index: true })
  conversationId: string;

  @Prop({ type: String, default: null })
  agentId: string | null;

  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ type: String, default: null })
  customerId: string | null;

  @Prop({ type: String, default: null })
  customerPhone: string | null;

  @Prop({ required: true })
  summary: string;

  @Prop({ required: true })
  interested: boolean;

  @Prop({ required: true })
  wantsFurtherContact: boolean;

  @Prop({ type: String, enum: ['positive', 'neutral', 'negative'], default: null })
  sentiment: 'positive' | 'neutral' | 'negative' | null;

  @Prop({ type: String, default: null })
  budgetMentioned: string | null;

  @Prop({ type: [String], default: [] })
  propertiesDiscussed: string[];

  /** `sales_properties` ids matching propertiesDiscussed (unknown names dropped). */
  @Prop({ type: [String], default: [] })
  propertiesDiscussedIds: string[];

  @Prop({ type: [String], default: [] })
  amenitiesOrFacilitiesRequested: string[];

  @Prop({ type: [String], default: [] })
  otherInterests: string[];

  @Prop({ type: String, default: null })
  nextSteps: string | null;

  @Prop({ required: true })
  analyzedAt: Date;
}

export const ConversationSummarySchema = SchemaFactory.createForClass(ConversationSummary);
