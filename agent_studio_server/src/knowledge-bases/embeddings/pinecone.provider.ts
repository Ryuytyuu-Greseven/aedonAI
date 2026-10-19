import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Index, Pinecone } from '@pinecone-database/pinecone';
import { KnowledgeBaseVectorMetadata } from '../../common/interfaces/knowledge-base-embedding.interface';

export const PINECONE_INDEX_TOKEN = Symbol('PINECONE_INDEX_TOKEN');

/** Pinecone index client scoped to the knowledge base embeddings index. */
export const pineconeIndexFactory: FactoryProvider<
  Index<KnowledgeBaseVectorMetadata>
> = {
  provide: PINECONE_INDEX_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const pinecone = new Pinecone({
      apiKey: config.getOrThrow<string>('PINECONE_API_KEY'),
    });
    return pinecone.index<KnowledgeBaseVectorMetadata>({
      name: config.getOrThrow<string>('PINECONE_INDEX'),
    });
  },
};
