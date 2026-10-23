import { Model } from 'mongoose';
import {
  ProductEnquiry,
  ProductEnquiryDocument,
  ProductEnquirySchema,
  ProductEnquiryStage,
} from '../../../../schema/product-enquiry.schema.js';
import { SalesState } from '../state/sales.state.js';
import { getMongooseConnection } from './mongoose-connection.js';

let modelPromise: Promise<Model<ProductEnquiryDocument>> | null = null;

function getProductEnquiryModel(): Promise<Model<ProductEnquiryDocument>> {
  if (!modelPromise) {
    modelPromise = getMongooseConnection().then((connection) =>
      connection.model<ProductEnquiryDocument>(ProductEnquiry.name, ProductEnquirySchema, 'product_enquiries'),
    );
  }
  return modelPromise;
}

// Records that `product` reached `stage` in this conversation, for the
// Product Stats tab in agent_studio. Idempotent — the unique
// (conversationId, propertyId, stage) key turns repeats (every presentation
// turn re-records `discussed`) into no-ops, first write wins. Never throws:
// callers fire-and-forget (`void recordProductEnquiry(...)`) so stats
// persistence can't stall or break a live turn.
export async function recordProductEnquiry(
  state: SalesState,
  product: { id: string; name: string } | null | undefined,
  stage: ProductEnquiryStage,
): Promise<void> {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  if (!product || !agentId || !state.sessionId) return;

  const conversationId = state.sessionId;
  const event: ProductEnquiry = {
    companyId: state.agentDetails?.companyId ?? null,
    agentId,
    propertyId: product.id,
    propertyName: product.name,
    conversationId,
    callId: state.callId || null,
    customerPhone: state.customerPhNo || null,
    stage,
    source: 'live',
    channel: state.channel === 'preview' ? 'preview' : 'live',
    at: new Date(),
  };

  try {
    const model = await getProductEnquiryModel();
    await model.updateOne(
      { conversationId, propertyId: product.id, stage },
      { $setOnInsert: event },
      { upsert: true },
    );
  } catch (error: any) {
    // 11000: a concurrent write for the same key won — that's the goal anyway.
    if (error?.code !== 11000) {
      console.error(`[ProductEnquiry] Failed to record ${stage} for ${product.id}:`, error);
    }
  }
}
