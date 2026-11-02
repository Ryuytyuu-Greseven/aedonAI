import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Leads attributed directly to an agent (e.g. gathered via live calls),
 * independent of the Meta pipeline (`meta_leads`) — mirrors its shape,
 * keyed by `agentId` instead of `pageId`.
 */
@Schema({ timestamps: true, collection: 'agent_leads' })
export class AgentLead extends Document {
    @Prop({ type: String, required: true, index: true })
    customerId: string;

    /** The agent this lead is attributed to — same id as Agent's Mongo `_id`. */
    @Prop({ type: String, required: true, index: true })
    agentId: string;

    @Prop({ type: String, required: true, unique: true, index: true })
    leadId: string;

    /** Where the lead came from, e.g. 'meta' | 'call' | 'manual'. */
    @Prop({ type: String })
    source: string;

    @Prop({ type: String })
    fullName: string;

    @Prop({ type: String })
    phoneNumber: string;

    @Prop({ type: String })
    email: string;

    // --- Real-estate sales qualification fields (captured across the call) ---

    @Prop({ type: String })
    address: string;

    @Prop({ type: Number })
    budgetMin: number;

    @Prop({ type: Number })
    budgetMax: number;

    @Prop({ type: String })
    preferredLocation: string;

    @Prop({ type: String })
    preferredType: string;

    /** When the customer wants to purchase/move in, in their own words. */
    @Prop({ type: String })
    purchaseTimeline: string;

    /** Purpose of purchase: 'end_user' (living) | 'investor' (rental/appreciation). */
    @Prop({ type: String })
    buyerType: string;

    /** Whether the customer is open to visiting the site in the coming days. */
    @Prop({ type: Boolean })
    siteVisitInterested: boolean;

    /** The day/time the customer proposed for a site visit, in their own words. */
    @Prop({ type: String })
    siteVisitPreferredDate: string;

    /** Preferred slot for site visit (e.g., 'morning', 'afternoon', '11:00 AM'). */
    @Prop({ type: String })
    siteVisitTimeSlot: string;

    /** Whether the customer requested complimentary cab pickup for site visit. */
    @Prop({ type: Boolean })
    cabRequired: boolean;

    /** The property id the customer confirmed purchase intent on, if any. */
    @Prop({ type: String })
    interestedPropertyId: string;

    @Prop({ type: String })
    referralName: string;

    @Prop({ type: String })
    referralPhone: string;

    /** Conversation/call session this lead was captured in. */
    @Prop({ type: String, index: true })
    sessionId: string;

    @Prop({ type: Object })
    customFields: Record<string, any>;

    /** When the lead was generated at its source, vs `createdAt` (row-insert time). */
    @Prop({ type: Date })
    leadCreatedAt: Date;
}

export const AgentLeadSchema = SchemaFactory.createForClass(AgentLead);

AgentLeadSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});
