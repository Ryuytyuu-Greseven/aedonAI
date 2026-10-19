import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { embeddingProviderFactory } from './embeddings/embedding-provider.factory';
import { textFormatterProviderFactory } from './embeddings/formatting/text-formatter-provider.factory';
import { KnowledgeBaseEmbeddingsService } from './embeddings/knowledge-base-embeddings.service';
import { TextExtractionService } from './embeddings/text-extraction.service';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { KnowledgeBaseSalesFormatterService } from './sales/knowledge-base-sales-formatter.service';
import { SalesPropertiesController } from './sales/sales-properties.controller';
import { SalesPropertiesService } from './sales/sales-properties.service';
import { KnowledgeBaseStorageService } from './storage/knowledge-base-storage.service';

@Module({
  imports: [ReposModule],
  controllers: [KnowledgeBasesController, SalesPropertiesController],
  providers: [
    KnowledgeBasesService,
    KnowledgeBaseEmbeddingsService,
    TextExtractionService,
    KnowledgeBaseStorageService,
    SalesPropertiesService,
    KnowledgeBaseSalesFormatterService,
    embeddingProviderFactory,
    textFormatterProviderFactory,
  ],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
