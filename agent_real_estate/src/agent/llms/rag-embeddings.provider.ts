import { VertexAIEmbeddings } from '@langchain/google-vertexai';
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
 * service (`lyreai_agent_builder_server`), always via Vertex AI. The model
 * name here MUST match that service's embedding model exactly (dimensions
 * coinciding is not enough — see vectorsearch.md §1) — override via
 * VERTEX_AI_EMBEDDING_MODEL if that service isn't on the `text-embedding-004`
 * default.
 */

let vertexRagEmbeddings: VertexAIEmbeddings | null = null;
function getVertexRagEmbeddings(): VertexAIEmbeddings {
  if (!vertexRagEmbeddings) {
    vertexRagEmbeddings = new VertexAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.VERTEX_AI_EMBEDDING_MODEL ?? 'text-embedding-004',
    });
  }
  return vertexRagEmbeddings;
}

/** Embeds one customer utterance/query for a Pinecone knowledge-base lookup. */
export async function embedRagQuery(text: string): Promise<number[]> {
  return getVertexRagEmbeddings().embedQuery(text);
}
