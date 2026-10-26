import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

config();

/**
 * Embeds queries for Pinecone knowledge-base retrieval (RAG) — kept
 * deliberately separate from `embeddingsInstance` in google.embeddings.ts.
 *
 * That instance uses `text-multilingual-embedding-002` for this server's own
 * self-contained MongoDB Atlas property vector search (this server both
 * writes and reads those vectors, so any model is fine as long as it's
 * consistent with itself).
 *
 * The Pinecone knowledge base, by contrast, is written by a DIFFERENT
 * service (agent_studio_server) via Vertex AI. The model here MUST match
 * that service's VERTEX_AI_EMBEDDING_MODEL exactly (dimensions coinciding is
 * not enough — see vectorsearch.md §1), and the dimension must match the
 * index. knowledge-base.store.ts also filters matches by RAG_EMBEDDING_MODEL,
 * so vectors from any other model are never compared against this query.
 */

export const RAG_EMBEDDING_MODEL = process.env.VERTEX_AI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
const RAG_EMBEDDING_DIMENSIONS = 768;

let vertexClient: GoogleGenAI | null = null;
function getVertexClient(): GoogleGenAI {
  if (!vertexClient) {
    vertexClient = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
    });
  }
  return vertexClient;
}

/** Embeds one customer utterance/query for a Pinecone knowledge-base lookup. */
export async function embedRagQuery(text: string): Promise<number[]> {
  const response = await getVertexClient().models.embedContent({
    model: RAG_EMBEDDING_MODEL,
    contents: [text],
    config: {
      // Pairs with the RETRIEVAL_DOCUMENT vectors the studio server indexes.
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: RAG_EMBEDDING_DIMENSIONS,
    },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error(`Embedding model ${RAG_EMBEDDING_MODEL} returned no vector`);
  }
  return values;
}
