import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const PRODUCT_ENQUIRIES_COLLECTION = 'product_enquiries';

export const PRODUCT_ENQUIRY_STAGES = [
  'discussed',
  'shortlisted',
  'purchase_intent',
  'site_visit',
] as const;
export type ProductEnquiryStage = (typeof PRODUCT_ENQUIRY_STAGES)[number];
export type ProductEnquirySource = 'live' | 'analysis';
export type ProductEnquiryChannel = 'live' | 'preview';

export type ProductEnquiryDocument = HydratedDocument<ProductEnquiry>;

/**
 * One product (`sales_properties` row) reaching a funnel stage in one
 * conversation. Written by the sales agents — live from the graph nodes and
 * after the call by conversation analysis — and only read here. The unique
 * `(conversationId, propertyId, stage)` key makes both writers idempotent:
 * whichever lands first wins and the other is a no-op.
 */
@Schema({ collection: PRODUCT_ENQUIRIES_COLLECTION, versionKey: false })
export class ProductEnquiry {
  @Prop({ type: String, default: null })
  companyId: string | null;

  /** Agent's Mongo `_id` — same key as `sales_properties.agentId`. */
  @Prop({ type: String, required: true })
  agentId: string;

  @Prop({ type: String, required: true })
  propertyId: string;

  /** Snapshot of the product name, so stats survive the product being deleted. */
  @Prop({ type: String, required: true })
  propertyName: string;

  /** The agent session/thread id — same key as `agent_leads.leadId` and `conversation_summaries.conversationId`. */
  @Prop({ type: String, required: true })
  conversationId: string;

  /** Provider CallSid (or webrtc session id) — joins to `call_logs._id`. */
  @Prop({ type: String, default: null })
  callId: string | null;

  @Prop({ type: String, default: null })
  customerPhone: string | null;

  @Prop({ type: String, required: true, enum: PRODUCT_ENQUIRY_STAGES })
  stage: ProductEnquiryStage;

  @Prop({ type: String, required: true, enum: ['live', 'analysis'] })
  source: ProductEnquirySource;

  /** `preview` for playground web calls / phone previews — excluded from stats. */
  @Prop({ type: String, required: true, enum: ['live', 'preview'] })
  channel: ProductEnquiryChannel;

  @Prop({ type: Date, required: true })
  at: Date;
}

export const ProductEnquirySchema =
  SchemaFactory.createForClass(ProductEnquiry);

ProductEnquirySchema.index(
  { conversationId: 1, propertyId: 1, stage: 1 },
  { unique: true },
);
// Serves the per-product $lookup in the product-stats aggregation.
ProductEnquirySchema.index({ agentId: 1, propertyId: 1, at: -1 });
