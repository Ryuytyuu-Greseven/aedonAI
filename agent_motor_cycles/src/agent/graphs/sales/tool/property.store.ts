import { MongoClient, Collection, Document } from 'mongodb';
import { config } from 'dotenv';
import { PropertyDocument } from './property.types.js';

config();

const COLLECTION_NAME = 'properties';
const VECTOR_INDEX_NAME = 'properties_vector_index';

// Lazily-connected singleton, mirroring the llmInstance/embeddingsInstance
// singleton pattern used elsewhere in the graph layer.
let clientPromise: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

async function getPropertiesCollection(): Promise<Collection<PropertyDocument>> {
  const client = await getClient();
  return client.db().collection<PropertyDocument>(COLLECTION_NAME);
}

const NO_EMBEDDING_PROJECTION = { projection: { embedding: 0, _id: 0 } } as const;

export async function findAllProperties(): Promise<PropertyDocument[]> {
  const collection = await getPropertiesCollection();
  return collection.find({}, NO_EMBEDDING_PROJECTION).toArray();
}

export async function findPropertiesByBudget(min: number, max: number): Promise<PropertyDocument[]> {
  const collection = await getPropertiesCollection();
  const ceiling = max * 1.10; // allow 10% above max to avoid near-range empty results
  return collection.find({ price: { $gte: min, $lte: ceiling } }, NO_EMBEDDING_PROJECTION).toArray();
}

export async function findPropertyById(id: string): Promise<PropertyDocument | null> {
  const collection = await getPropertiesCollection();
  return collection.findOne({ id }, NO_EMBEDDING_PROJECTION);
}

export async function vectorSearchProperties(
  queryEmbedding: number[],
  opts: { limit?: number; minPrice?: number; maxPrice?: number } = {},
): Promise<PropertyDocument[]> {
  const { limit = 5, minPrice, maxPrice } = opts;
  const collection = await getPropertiesCollection();

  const priceFilter: Record<string, number> = {};
  if (minPrice !== undefined) priceFilter.$gte = minPrice;
  if (maxPrice !== undefined) priceFilter.$lte = maxPrice;

  const pipeline: Document[] = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 20, 100),
        limit,
        ...(Object.keys(priceFilter).length ? { filter: { price: priceFilter } } : {}),
      },
    },
    { $project: { embedding: 0, _id: 0 } },
  ];

  return collection.aggregate<PropertyDocument>(pipeline).toArray();
}

// Used only by scripts/seed-properties.ts
export async function upsertProperty(doc: PropertyDocument): Promise<void> {
  const collection = await getPropertiesCollection();
  await collection.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
}

export async function closePropertyStoreConnection(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = null;
  }
}
