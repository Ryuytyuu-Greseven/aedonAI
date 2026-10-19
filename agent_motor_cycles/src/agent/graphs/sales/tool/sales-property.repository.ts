import { Model } from 'mongoose';
import { SalesProperty, SalesPropertyDocument, SalesPropertySchema } from '../../../../schema/sales-properties.schema.js';
import { getMongooseConnection } from './mongoose-connection.js';

let modelPromise: Promise<Model<SalesProperty>> | null = null;

function getSalesPropertyModel(): Promise<Model<SalesProperty>> {
  if (!modelPromise) {
    modelPromise = getMongooseConnection().then((connection) =>
      connection.model<SalesProperty>(SalesProperty.name, SalesPropertySchema, 'sales_properties'),
    );
  }
  return modelPromise;
}

export interface SalesPropertyRecord {
  id: string;
  companyId: string | null;
  agentId: string;
  name: string;
  description: string | null;
}

function toRecord(doc: SalesPropertyDocument): SalesPropertyRecord {
  return {
    id: String(doc._id),
    companyId: doc.companyId,
    agentId: doc.agentId,
    name: doc.name,
    description: doc.description,
  };
}

/**
 * The properties linked to this agent — scoped to `agentId`, and
 * defensively also to `companyId` when known (same defense-in-depth pattern
 * as the Pinecone knowledge-base companyId filter: agentId alone already
 * scopes correctly, this just guards against an agentId ever being
 * reused/misrouted across companies).
 */
export async function findPropertiesByAgentId(
  agentId: string,
  companyId?: string | null,
): Promise<SalesPropertyRecord[]> {
  if (!agentId) return [];

  const model = await getSalesPropertyModel();
  const filter: Record<string, unknown> = { agentId };
  if (companyId) filter.companyId = companyId;

  const docs = await model.find(filter).lean<SalesPropertyDocument[]>().exec();
  return docs.map(toRecord);
}
