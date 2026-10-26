import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingProvider,
  EmbeddingProviderName,
  KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS,
} from '../../../common/interfaces/knowledge-base-embedding.interface';
import { withRetry } from '../../../common/utils/retry.util';

// Multilingual, so Hindi/Telugu customer questions match English brochure
// text (text-embedding-004 is English-only). The sales agents embed their
// queries with this same model — keep VERTEX_AI_EMBEDDING_MODEL in sync.
const DEFAULT_MODEL = 'gemini-embedding-001';
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
    const response = await withRetry(() =>
      this.client.models.embedContent({
        model: this.model,
        contents: texts,
        config: {
          taskType: 'RETRIEVAL_DOCUMENT',
          // Truncated to fit the existing Pinecone index.
          outputDimensionality: KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS,
        },
      }),
    );
    return (response.embeddings ?? []).map(
      (embedding) => embedding.values ?? [],
    );
  }
}
