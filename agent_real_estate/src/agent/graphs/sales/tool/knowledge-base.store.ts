import { getKnowledgeBaseIndex, isPineconeConfigured } from '../../../llms/pinecone.provider.js';
import { embedRagQuery, RAG_EMBEDDING_MODEL } from '../../../llms/rag-embeddings.provider.js';

export interface RagMatch {
  text: string;
  score: number;
}

export interface RagQueryOptions {
  /** Agent.knowledge_base_ids — the only knowledge bases this agent may search (vectorsearch.md §3). */
  knowledgeBaseIds: string[];
  /** Defense in depth alongside knowledge_base_id — see vectorsearch.md §4.3. */
  companyId?: string | null;
  topK?: number;
  /**
   * Cosine score cutoff (the index metric; higher = more similar) below
   * which a match is discarded. Defaults to RAG_MIN_SCORE, else 0.6.
   */
  minScore?: number;
}

const DEFAULT_TOP_K = 5;
// Measured with gemini-embedding-001 @768 on headed section chunks: relevant
// matches ~0.71–0.79 (English, Hindi, Telugu), unrelated ~0.42–0.57.
const DEFAULT_MIN_SCORE = parseMinScore(process.env.RAG_MIN_SCORE) ?? 0.6;

function parseMinScore(value: string | undefined): number | null {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Raw Pinecone retrieval — embeds `queryText`, queries the shared
 * knowledge-base index scoped to `knowledgeBaseIds`/`companyId`, and returns
 * the active, above-threshold matches. Never throws: Pinecone/embedding
 * failures are logged and treated as "no context" (vectorsearch.md §6) so a
 * live call never drops because retrieval hiccuped.
 */
export async function queryKnowledgeBase(queryText: string, opts: RagQueryOptions): Promise<RagMatch[]> {
  const { knowledgeBaseIds, companyId, topK = DEFAULT_TOP_K, minScore = DEFAULT_MIN_SCORE } = opts;

  // Empty $in matches nothing usefully and wastes a round trip (§4.3).
  if (!knowledgeBaseIds.length) return [];
  if (!isPineconeConfigured()) return [];
  if (!queryText.trim()) return [];

  try {
    const queryVector = await embedRagQuery(queryText);
    const index = getKnowledgeBaseIndex();

    const results = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter: {
        knowledge_base_id: { $in: knowledgeBaseIds },
        status: { $eq: 'active' },
        companyId: { $eq: companyId ?? '' },
        // Only vectors from our own query model are comparable.
        model: { $eq: RAG_EMBEDDING_MODEL },
      },
    });

    return (results.matches ?? [])
      .filter((m) => (m.score ?? 0) >= minScore)
      .map((m) => ({ text: m.metadata?.text ?? '', score: m.score ?? 0 }))
      .filter((m) => m.text.length > 0);
  } catch (error) {
    console.error('[RAG] Pinecone knowledge-base query failed — falling back to no context:', error);
    return [];
  }
}

/**
 * Convenience wrapper for node prompts: joins matched chunks into one
 * grounding block, or null if nothing cleared the relevance threshold —
 * callers should fall back to their own general behavior in that case
 * (§4.4), not claim no answer exists.
 */
export async function getRagContext(queryText: string, opts: RagQueryOptions): Promise<string | null> {
  const matches = await queryKnowledgeBase(queryText, opts);
  if (!matches.length) return null;
  return matches.map((m) => m.text).join('\n\n---\n\n');
}
