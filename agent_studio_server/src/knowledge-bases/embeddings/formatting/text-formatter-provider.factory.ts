import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiTextFormatterProvider } from './providers/openai-text-formatter.provider';
import { VertexAiTextFormatterProvider } from './providers/vertex-ai-text-formatter.provider';
import { TextFormatterProvider } from './text-formatter.interface';

export const TEXT_FORMATTER_PROVIDER_TOKEN = Symbol(
  'TEXT_FORMATTER_PROVIDER_TOKEN',
);

const logger = new Logger('TextFormatterProviderFactory');

/**
 * Mirrors embedding-provider.factory.ts: the sales-formatting LLM follows
 * the same EMBEDDING_PROVIDER choice rather than its own env var, so
 * formatting reuses whichever credentials are already configured.
 */
export const textFormatterProviderFactory: FactoryProvider<TextFormatterProvider> =
  {
    provide: TEXT_FORMATTER_PROVIDER_TOKEN,
    inject: [ConfigService],
    useFactory: (config: ConfigService): TextFormatterProvider => {
      const provider = config.get<string>('EMBEDDING_PROVIDER');
      if (provider === 'vertex-ai') {
        logger.log('Using Vertex AI (Gemini) for sales-format generation');
        return new VertexAiTextFormatterProvider(config);
      }
      logger.log('Using OpenAI for sales-format generation');
      return new OpenAiTextFormatterProvider(config);
    },
  };
