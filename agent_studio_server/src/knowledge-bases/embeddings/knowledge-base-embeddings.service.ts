import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EmbeddingProvider,
  EmbeddingSourceType,
} from '../../common/interfaces/knowledge-base-embedding.interface';
import { KnowledgeBaseEmbeddingsRepository } from '../../repos/knowledge-base-embeddings.repository';
import { KnowledgeBasesRepository } from '../../repos/knowledge-bases.repository';
import { KnowledgeBaseSalesFormatterService } from '../sales/knowledge-base-sales-formatter.service';
import { EMBEDDING_PROVIDER_TOKEN } from './embedding-provider.factory';
import { chunkText } from './text-chunking.util';
import { TextExtractionService } from './text-extraction.service';

// Kept small on purpose: Vertex AI's text embedding models cap a single
// request at ~20k tokens total, and our chunks can run up to ~1000 words
// (~1300+ tokens) each, so a large batch count risks blowing that limit.
const EMBEDDING_BATCH_SIZE = 10;

/**
 * Indexing side of the knowledge base RAG pipeline: turns an uploaded file
 * or url into embedded, searchable chunks, and keeps them in sync as files/
 * urls are added, disabled or enabled. Retrieval (querying these embeddings
 * to answer end-user questions) is handled elsewhere.
 */
@Injectable()
export class KnowledgeBaseEmbeddingsService {
  private readonly logger = new Logger(KnowledgeBaseEmbeddingsService.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly textExtraction: TextExtractionService,
    private readonly salesFormatter: KnowledgeBaseSalesFormatterService,
    private readonly embeddingsRepository: KnowledgeBaseEmbeddingsRepository,
    private readonly knowledgeBasesRepository: KnowledgeBasesRepository,
  ) {}

  /**
   * Extracts, chunks, embeds and stores a newly uploaded file's content.
   * Intended to run fire-and-forget: never throws, updates embedding_status
   * on the file instead.
   */
  async indexFile(
    knowledgeBaseId: string,
    fileId: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
    companyId: string | null,
  ): Promise<void> {
    try {
      const text = await this.textExtraction.extractFromFile(
        buffer,
        filename,
        mimetype,
      );
      await this.indexSource(knowledgeBaseId, 'file', fileId, text, companyId);
      await this.knowledgeBasesRepository.setFileEmbeddingStatus(
        knowledgeBaseId,
        fileId,
        'completed',
      );
    } catch (error) {
      this.logger.error(
        `Failed to index file ${fileId} of knowledge base ${knowledgeBaseId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.knowledgeBasesRepository.setFileEmbeddingStatus(
        knowledgeBaseId,
        fileId,
        'failed',
      );
    }
  }

  /**
   * Fetches, chunks, embeds and stores a url's page content. Intended to run
   * fire-and-forget: never throws, updates embedding_status on the url
   * instead.
   */
  async indexUrl(
    knowledgeBaseId: string,
    urlId: string,
    url: string,
    companyId: string | null,
  ): Promise<void> {
    try {
      const text = await this.textExtraction.extractFromUrl(url);
      await this.indexSource(knowledgeBaseId, 'url', urlId, text, companyId);
      await this.knowledgeBasesRepository.setUrlEmbeddingStatus(
        knowledgeBaseId,
        urlId,
        'completed',
      );
    } catch (error) {
      this.logger.error(
        `Failed to index url ${urlId} of knowledge base ${knowledgeBaseId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.knowledgeBasesRepository.setUrlEmbeddingStatus(
        knowledgeBaseId,
        urlId,
        'failed',
      );
    }
  }

  /**
   * Excludes/restores a file or url's existing embeddings from retrieval on
   * disable/enable. Chunks and vectors are kept and just toggled, since the
   * source text is already fully captured in them and re-embedding on every
   * toggle would recompute nothing new.
   */
  async setSourceActive(
    knowledgeBaseId: string,
    sourceType: EmbeddingSourceType,
    sourceId: string,
    active: boolean,
  ): Promise<void> {
    await this.embeddingsRepository.setStatusBySource(
      knowledgeBaseId,
      sourceType,
      sourceId,
      active ? 'active' : 'disabled',
    );
  }

  private async indexSource(
    knowledgeBaseId: string,
    sourceType: EmbeddingSourceType,
    sourceId: string,
    text: string,
    companyId: string | null,
  ): Promise<void> {
    const formattedText = await this.salesFormatter.format(text);
    const chunks = chunkText(formattedText);
    if (chunks.length === 0) {
      throw new Error('No extractable text content found');
    }

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchVectors = await this.embeddingProvider.embed(batch);
      if (batchVectors.length !== batch.length) {
        // Fail the whole source rather than silently writing chunks with a
        // missing embedding (insertMany is ordered, so a validation error
        // partway through would otherwise leave an orphaned partial insert).
        throw new Error(
          `Embedding provider returned ${batchVectors.length} vectors for a batch of ${batch.length} chunks`,
        );
      }
      vectors.push(...batchVectors);
    }

    // Replace any embeddings left over from a previous attempt for this source.
    await this.embeddingsRepository.deleteBySource(
      knowledgeBaseId,
      sourceType,
      sourceId,
    );
    await this.embeddingsRepository.insertMany(
      chunks.map((chunkContent, index) => ({
        companyId,
        knowledge_base_id: knowledgeBaseId,
        source_type: sourceType,
        source_id: sourceId,
        chunk_index: index,
        text: chunkContent,
        embedding: vectors[index],
        provider: this.embeddingProvider.name,
        model: this.embeddingProvider.model,
        status: 'active' as const,
      })),
    );
  }
}
