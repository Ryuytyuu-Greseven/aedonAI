import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductEnquiryDocument = HydratedDocument<ProductEnquiry>;

export type ProductEnquiryStage = 'discussed' | 'shortlisted' | 'purchase_intent' | 'site_visit';

/**
 * One product (`sales_properties` row) reaching a funnel stage in one
 * conversation — read by agent_studio_server's product stats. Mirrors
 * agent_studio_server/src/schemas/product-enquiry.schema.ts; the unique
 * `(conversationId, propertyId, stage)` key makes every write idempotent, so
 * live graph writes and post-call analysis writes never double count.
 */
@Schema({ collection: 'product_enquiries', versionKey: false })
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

    /** The graph's sessionId/threadId — same key as `agent_leads.leadId`. */
    @Prop({ type: String, required: true })
    conversationId: string;

    /** Provider CallSid (or webrtc session id) — joins to `call_logs._id`. */
    @Prop({ type: String, default: null })
    callId: string | null;

    @Prop({ type: String, default: null })
    customerPhone: string | null;

    @Prop({ type: String, required: true, enum: ['discussed', 'shortlisted', 'purchase_intent', 'site_visit'] })
    stage: ProductEnquiryStage;

    @Prop({ type: String, required: true, enum: ['live', 'analysis'] })
    source: 'live' | 'analysis';

    /** `preview` for playground traffic — excluded from stats. */
    @Prop({ type: String, required: true, enum: ['live', 'preview'] })
    channel: 'live' | 'preview';

    @Prop({ type: Date, required: true })
    at: Date;
}

export const ProductEnquirySchema = SchemaFactory.createForClass(ProductEnquiry);

ProductEnquirySchema.index({ conversationId: 1, propertyId: 1, stage: 1 }, { unique: true });
ProductEnquirySchema.index({ agentId: 1, propertyId: 1, at: -1 });
