/** Which knowledge base item a set of embedding chunks was derived from. */
export type EmbeddingSourceType = 'file' | 'url';

/**
 * Lifecycle of a knowledge base file/url's embeddings. `not_applicable` is
 * for sources with no text to embed (e.g. images) that are stored but never
 * indexed.
 */
export type KnowledgeItemEmbeddingStatus =
  'pending' | 'completed' | 'failed' | 'not_applicable';

export type EmbeddingProviderName = 'openai' | 'vertex-ai';

/** Dimension of the shared Pinecone knowledge base index. */
export const KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS = 768;

/** Generates vector embeddings for a batch of text chunks via a specific model/provider. */
export interface EmbeddingProvider {
  readonly name: EmbeddingProviderName;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Metadata stored alongside each chunk's vector in Pinecone. Pinecone metadata
 * has no null type, so `companyId` uses `''` in place of the Mongo schema's
 * `null` for "no company".
 */
export type KnowledgeBaseVectorMetadata = {
  companyId: string;
  knowledge_base_id: string;
  source_type: EmbeddingSourceType;
  source_id: string;
  /** The url's label or the file's filename. */
  source_label: string;
  chunk_index: number;
  /** Formatter section key (e.g. `amenities`), or `raw` when unformatted. */
  section: string;
  text: string;
  provider: string;
  model: string;
  status: 'active' | 'disabled';
};
