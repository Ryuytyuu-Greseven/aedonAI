import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  EmbeddingProvider,
  EmbeddingProviderName,
} from '../../../common/interfaces/knowledge-base-embedding.interface';

const DEFAULT_MODEL = 'text-embedding-3-small';

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name: EmbeddingProviderName = 'openai';
  readonly model: string;
  private readonly client: OpenAI;

  constructor(config: ConfigService) {
    this.model = config.get<string>('OPENAI_EMBEDDING_MODEL') ?? DEFAULT_MODEL;
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
