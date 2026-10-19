import { GoogleGenAI, Type } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProviderName } from '../../../../common/interfaces/knowledge-base-embedding.interface';
import {
  REAL_ESTATE_SALES_SECTIONS,
  REAL_ESTATE_SALES_PROMPT,
  RealEstateSalesSections,
} from '../../../sales/real-estate-sales.profile';
import { TextFormatterProvider } from '../text-formatter.interface';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_LOCATION = 'us-central1';

/** Gemini's structured-output schema: every section is a nullable string. */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: Object.fromEntries(
    REAL_ESTATE_SALES_SECTIONS.map(({ key, description }) => [
      key,
      { type: Type.STRING, nullable: true, description },
    ]),
  ),
  required: REAL_ESTATE_SALES_SECTIONS.map(({ key }) => key),
};

export class VertexAiTextFormatterProvider implements TextFormatterProvider {
  readonly name: EmbeddingProviderName = 'vertex-ai';
  private readonly model: string;
  private readonly client: GoogleGenAI;

  constructor(config: ConfigService) {
    this.model = config.get<string>('VERTEX_AI_CHAT_MODEL') ?? DEFAULT_MODEL;
    this.client = new GoogleGenAI({
      vertexai: true,
      project: config.getOrThrow<string>('GOOGLE_CLOUD_PROJECT'),
      location: config.get<string>('GOOGLE_CLOUD_LOCATION') ?? DEFAULT_LOCATION,
    });
  }

  async formatSections(rawText: string): Promise<RealEstateSalesSections> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: REAL_ESTATE_SALES_PROMPT.replace('{{RAW_TEXT}}', rawText),
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Vertex AI returned no content for sales formatting');
    }
    return JSON.parse(text) as RealEstateSalesSections;
  }
}
