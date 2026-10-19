import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';
import { VertexAiEmbeddingProvider } from './providers/vertex-ai-embedding.provider';
import { EmbeddingProvider } from '../../common/interfaces/knowledge-base-embedding.interface';

export const EMBEDDING_PROVIDER_TOKEN = Symbol('EMBEDDING_PROVIDER_TOKEN');

const logger = new Logger('EmbeddingProviderFactory');

/**
 * Builds only the configured embedding provider (via EMBEDDING_PROVIDER),
 * so the other provider's env vars/credentials never need to be set.
 */
export const embeddingProviderFactory: FactoryProvider<EmbeddingProvider> = {
  provide: EMBEDDING_PROVIDER_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmbeddingProvider => {
    const provider = config.get<string>('EMBEDDING_PROVIDER');
    if (provider === 'vertex-ai') {
      logger.log('Using Vertex AI (Gemini) embedding provider');
      return new VertexAiEmbeddingProvider(config);
    }
    logger.log('Using OpenAI embedding provider');
    return new OpenAiEmbeddingProvider(config);
  },
};
