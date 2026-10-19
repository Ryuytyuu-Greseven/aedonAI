import { Inject, Injectable, Logger } from '@nestjs/common';
import { Index, PineconeRecord } from '@pinecone-database/pinecone';

import {
  EmbeddingSourceType,
  KnowledgeBaseVectorMetadata,
} from '../common/interfaces/knowledge-base-embedding.interface';
import { PINECONE_INDEX_TOKEN } from '../knowledge-bases/embeddings/pinecone.provider';
import { KnowledgeItemStatus } from '../schemas/knowledge-base.schema';

export type NewKnowledgeBaseEmbeddingChunk = Omit<
  KnowledgeBaseVectorMetadata,
  'companyId'
> & {
  companyId: string | null;
  embedding: number[];
};

// Pinecone's own per-request cap; keep upserts under it regardless of the
// caller's chunking batch size.
const UPSERT_BATCH_SIZE = 100;

@Injectable()
export class KnowledgeBaseEmbeddingsRepository {
  private readonly logger = new Logger(KnowledgeBaseEmbeddingsRepository.name);

  constructor(
    @Inject(PINECONE_INDEX_TOKEN)
    private readonly index: Index<KnowledgeBaseVectorMetadata>,
  ) {}

  async insertMany(chunks: NewKnowledgeBaseEmbeddingChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }
    const records = chunks.map((chunk) => toRecord(chunk));
    for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
      await this.index.upsert({
        records: records.slice(i, i + UPSERT_BATCH_SIZE),
      });
    }
  }

  /**
   * Best-effort cleanup: Pinecone throws when a filtered delete matches no
   * vectors (e.g. a source's first-ever index attempt) or when the index's
   * plan/type doesn't support delete-by-metadata-filter. Neither case should
   * block re-indexing, so failures are logged and swallowed rather than
   * propagated to the caller.
   */
  async deleteBySource(
    knowledgeBaseId: string,
    sourceType: EmbeddingSourceType,
    sourceId: string,
  ): Promise<void> {
    try {
      await this.index.deleteMany({
        filter: sourceFilter(knowledgeBaseId, sourceType, sourceId),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete existing Pinecone embeddings for ${sourceType} ${sourceId} of knowledge base ${knowledgeBaseId}; continuing without cleanup: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Flips status on a source's existing vectors without recomputing them:
   * Pinecone has no "update metadata by filter", so matching records are
   * fetched (values included) and re-upserted with the new status.
   */
  async setStatusBySource(
    knowledgeBaseId: string,
    sourceType: EmbeddingSourceType,
    sourceId: string,
    status: KnowledgeItemStatus,
  ): Promise<void> {
    const filter = sourceFilter(knowledgeBaseId, sourceType, sourceId);
    let paginationToken: string | undefined;
    do {
      const page = await this.index.fetchByMetadata({
        filter,
        limit: UPSERT_BATCH_SIZE,
        paginationToken,
      });
      const records = Object.values(page.records).map((record) => ({
        ...record,
        metadata: { ...record.metadata, status } as KnowledgeBaseVectorMetadata,
      }));
      if (records.length > 0) {
        await this.index.upsert({ records });
      }
      paginationToken = page.pagination?.next;
    } while (paginationToken);
  }
}

function sourceFilter(
  knowledgeBaseId: string,
  sourceType: EmbeddingSourceType,
  sourceId: string,
): object {
  return {
    knowledge_base_id: { $eq: knowledgeBaseId },
    source_type: { $eq: sourceType },
    source_id: { $eq: sourceId },
  };
}

function toRecord(
  chunk: NewKnowledgeBaseEmbeddingChunk,
): PineconeRecord<KnowledgeBaseVectorMetadata> {
  const { embedding, companyId, ...metadata } = chunk;
  return {
    id: `${chunk.knowledge_base_id}:${chunk.source_type}:${chunk.source_id}:${chunk.chunk_index}`,
    values: embedding,
    metadata: { ...metadata, companyId: companyId ?? '' },
  };
}
