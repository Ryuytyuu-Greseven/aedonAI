import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingProvider,
  EmbeddingProviderName,
} from '../../../common/interfaces/knowledge-base-embedding.interface';

const DEFAULT_MODEL = 'text-embedding-004';
const DEFAULT_LOCATION = 'us-central1';

export class VertexAiEmbeddingProvider implements EmbeddingProvider {
  readonly name: EmbeddingProviderName = 'vertex-ai';
  readonly model: string;
  private readonly client: GoogleGenAI;

  constructor(config: ConfigService) {
    this.model =
      config.get<string>('VERTEX_AI_EMBEDDING_MODEL') ?? DEFAULT_MODEL;
    this.client = new GoogleGenAI({
      vertexai: true,
      project: config.getOrThrow<string>('GOOGLE_CLOUD_PROJECT'),
      location: config.get<string>('GOOGLE_CLOUD_LOCATION') ?? DEFAULT_LOCATION,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.models.embedContent({
      model: this.model,
      contents: texts,
    });
    return (response.embeddings ?? []).map(
      (embedding) => embedding.values ?? [],
    );
  }
}
