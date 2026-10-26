import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EmbeddingProvider,
  EmbeddingSourceType,
} from '../../common/interfaces/knowledge-base-embedding.interface';
import { KnowledgeBaseEmbeddingsRepository } from '../../repos/knowledge-base-embeddings.repository';
import { KnowledgeBasesRepository } from '../../repos/knowledge-bases.repository';
import {
  KnowledgeBaseFile,
  KnowledgeBaseUrl,
  KnowledgeItemStatus,
} from '../../schemas/knowledge-base.schema';
import { KnowledgeBaseSalesFormatterService } from '../sales/knowledge-base-sales-formatter.service';
import { KnowledgeBaseStorageService } from '../storage/knowledge-base-storage.service';
import { EMBEDDING_PROVIDER_TOKEN } from './embedding-provider.factory';
import { buildChunks } from './text-chunking.util';
import { TextExtractionService } from './text-extraction.service';

// Kept small on purpose so a single embedding request stays well within
// the provider's per-request token limit, even for ~300-word chunks.
const EMBEDDING_BATCH_SIZE = 10;

/**
 * Indexing side of the knowledge base RAG pipeline: turns an uploaded file
 * or url into embedded, searchable chunks, and keeps them in sync as files/
 * urls are added, disabled, enabled or re-indexed. Retrieval (querying these
 * embeddings to answer end-user questions) is handled by the agent servers.
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
    private readonly storage: KnowledgeBaseStorageService,
  ) {}

  /**
   * Extracts, chunks, embeds and stores a file's content, with its vectors
   * written as `status` (a disabled file re-indexed stays excluded from
   * retrieval). Never throws: updates embedding_status on the file instead,
   * so it's safe to run fire-and-forget.
   */
  async indexFile(
    knowledgeBaseId: string,
    fileId: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
    companyId: string | null,
    status: KnowledgeItemStatus = 'active',
  ): Promise<void> {
    try {
      const text = await this.textExtraction.extractFromFile(
        buffer,
        filename,
        mimetype,
      );
      await this.indexSource(knowledgeBaseId, 'file', fileId, filename, text, {
        companyId,
        status,
      });
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
   * Fetches, chunks, embeds and stores a url's page content, with its
   * vectors written as `status`. Never throws: updates embedding_status on
   * the url instead, so it's safe to run fire-and-forget.
   */
  async indexUrl(
    knowledgeBaseId: string,
    urlId: string,
    url: string,
    label: string,
    companyId: string | null,
    status: KnowledgeItemStatus = 'active',
  ): Promise<void> {
    try {
      const text = await this.textExtraction.extractFromUrl(url);
      await this.indexSource(knowledgeBaseId, 'url', urlId, label || url, text, {
        companyId,
        status,
      });
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
   * Re-indexes a stored file from its original in GCS, keeping its current
   * active/disabled status. `companyId` is the knowledge base's (legacy
   * files may not carry their own). Never throws (see indexFile).
   */
  async reindexFile(
    knowledgeBaseId: string,
    file: KnowledgeBaseFile,
    companyId: string | null,
  ): Promise<void> {
    let buffer: Buffer;
    try {
      buffer = await this.storage.downloadFile(file.cloud_file_path);
    } catch (error) {
      this.logger.error(
        `Failed to download file ${file.file_id} of knowledge base ${knowledgeBaseId} for re-indexing`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.knowledgeBasesRepository.setFileEmbeddingStatus(
        knowledgeBaseId,
        file.file_id,
        'failed',
      );
      return;
    }
    // No stored mimetype; extraction falls back to the filename extension.
    await this.indexFile(
      knowledgeBaseId,
      file.file_id,
      file.filename,
      buffer,
      '',
      companyId,
      file.status ?? 'active',
    );
  }

  /**
   * Re-fetches and re-indexes a url, keeping its current active/disabled
   * status. `companyId` is the knowledge base's. Never throws.
   */
  async reindexUrl(
    knowledgeBaseId: string,
    url: KnowledgeBaseUrl,
    companyId: string | null,
  ): Promise<void> {
    await this.indexUrl(
      knowledgeBaseId,
      url.url_id,
      url.url,
      url.label,
      companyId,
      url.status ?? 'active',
    );
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
    sourceLabel: string,
    text: string,
    { companyId, status }: { companyId: string | null; status: KnowledgeItemStatus },
  ): Promise<void> {
    const formatted = await this.salesFormatter.format(text);
    const chunks = buildChunks(formatted, text, sourceLabel);
    if (chunks.length === 0) {
      throw new Error('No extractable text content found');
    }

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchVectors = await this.embeddingProvider.embed(
        batch.map((chunk) => chunk.text),
      );
      if (batchVectors.length !== batch.length) {
        // Fail the whole source rather than silently writing chunks with a
        // missing embedding.
        throw new Error(
          `Embedding provider returned ${batchVectors.length} vectors for a batch of ${batch.length} chunks`,
        );
      }
      vectors.push(...batchVectors);
    }

    // Only replace the source's previous embeddings once every new vector
    // exists, so a failed (re-)index leaves the old ones searchable.
    await this.embeddingsRepository.deleteBySource(
      knowledgeBaseId,
      sourceType,
      sourceId,
    );
    await this.embeddingsRepository.insertMany(
      chunks.map((chunk, index) => ({
        companyId,
        knowledge_base_id: knowledgeBaseId,
        source_type: sourceType,
        source_id: sourceId,
        source_label: sourceLabel,
        chunk_index: index,
        section: chunk.section,
        text: chunk.text,
        embedding: vectors[index],
        provider: this.embeddingProvider.name,
        model: this.embeddingProvider.model,
        status,
      })),
    );
  }
}
