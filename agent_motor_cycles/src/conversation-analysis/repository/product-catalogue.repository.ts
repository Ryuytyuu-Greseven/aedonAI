import { Types } from 'mongoose';
import { getConversationAnalysisConnection } from '../mongo/connection.js';

// Raw collection access rather than Mongoose models: this module must not
// import from src/agent/** or share its schemas, and it only needs to read
// the catalogue and append idempotent events. Shape of `product_enquiries`
// is owned by agent_studio_server/src/schemas/product-enquiry.schema.ts.

export interface CatalogueProduct {
  id: string;
  name: string;
}

export async function findProductsForAgent(
  agentId: string,
  companyId?: string | null,
): Promise<CatalogueProduct[]> {
  const connection = await getConversationAnalysisConnection();
  const filter: Record<string, unknown> = { agentId };
  if (companyId) filter.companyId = companyId;
  const docs = await connection
    .collection<{ _id: Types.ObjectId; name: string }>('sales_properties')
    .find(filter, { projection: { name: 1 } })
    .toArray();
  return docs.map((doc) => ({ id: String(doc._id), name: doc.name }));
}

export interface AnalysisEnquiryInput {
  conversationId: string;
  agentId: string;
  companyId: string | null;
  callId: string | null;
  customerPhone: string | null;
  channel: 'live' | 'preview';
  at: Date;
}

/**
 * Records a `discussed` event per product the analysis found — `$setOnInsert`
 * on the unique (conversationId, propertyId, stage) key, so a product the
 * live graph already recorded keeps its live event untouched.
 */
export async function recordDiscussedProducts(
  input: AnalysisEnquiryInput,
  products: CatalogueProduct[],
): Promise<void> {
  if (products.length === 0) return;
  const connection = await getConversationAnalysisConnection();
  const collection = connection.collection('product_enquiries');
  await Promise.all(
    products.map(async (product) => {
      try {
        await collection.updateOne(
          { conversationId: input.conversationId, propertyId: product.id, stage: 'discussed' },
          {
            $setOnInsert: {
              companyId: input.companyId,
              agentId: input.agentId,
              propertyId: product.id,
              propertyName: product.name,
              conversationId: input.conversationId,
              callId: input.callId,
              customerPhone: input.customerPhone,
              stage: 'discussed',
              source: 'analysis',
              channel: input.channel,
              at: input.at,
            },
          },
          { upsert: true },
        );
      } catch (error: any) {
        // 11000: a concurrent live write for the same key won.
        if (error?.code !== 11000) throw error;
      }
    }),
  );
}
