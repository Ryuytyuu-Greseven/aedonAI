import { Pinecone, Index, RecordMetadataValue } from '@pinecone-database/pinecone';
import { config } from 'dotenv';

config();

/**
 * Metadata shape written by the knowledge-base writer service
 * (`aedonai_agent_builder_server`) — see vectorsearch.md §2. This server only
 * ever reads it; the shape is fixed by the writer and must not be changed
 * here.
 */
export interface KnowledgeBaseVectorMetadata extends Record<string, RecordMetadataValue> {
  companyId: string;
  knowledge_base_id: string;
  source_type: 'file' | 'url';
  source_id: string;
  chunk_index: number;
  text: string;
  provider: string;
  model: string;
  status: 'active' | 'disabled';
}

// Lazy singletons, mirroring the llmInstance/embeddingsInstance pattern
// elsewhere in src/agent/llms/.
let clientInstance: Pinecone | null = null;
let indexInstance: Index<KnowledgeBaseVectorMetadata> | null = null;

function getPineconeClient(): Pinecone {
  if (!clientInstance) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error('PINECONE_API_KEY is not set');
    clientInstance = new Pinecone({ apiKey });
  }
  return clientInstance;
}

/**
 * The shared knowledge-base index — same Pinecone project/index the writer
 * service populates. No namespaces are used (vectorsearch.md §2), and this
 * server must never write to it (§7) — read-only `.query()` calls only.
 */
export function getKnowledgeBaseIndex(): Index<KnowledgeBaseVectorMetadata> {
  if (!indexInstance) {
    const name = process.env.PINECONE_INDEX;
    if (!name) throw new Error('PINECONE_INDEX is not set');
    indexInstance = getPineconeClient().index<KnowledgeBaseVectorMetadata>({ name });
  }
  return indexInstance;
}

export function isPineconeConfigured(): boolean {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}
