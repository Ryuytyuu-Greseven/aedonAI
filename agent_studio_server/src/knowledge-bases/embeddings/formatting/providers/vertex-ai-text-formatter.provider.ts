import { GoogleGenAI, Type } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProviderName } from '../../../../common/interfaces/knowledge-base-embedding.interface';
import {
  REAL_ESTATE_SALES_SECTIONS,
  REAL_ESTATE_SALES_PROMPT,
  RealEstateSalesFormatterOutput,
  SUBJECT_NAME_DESCRIPTION,
} from '../../../sales/real-estate-sales.profile';
import { TextFormatterProvider } from '../text-formatter.interface';

// gemini-2.0-flash is no longer served on this project (404), which silently
// sent every upload down the raw-text fallback. Same model as the agents use.
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_LOCATION = 'us-central1';

/** Gemini's structured-output schema: the subject and every section are nullable strings. */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subjectName: {
      type: Type.STRING,
      nullable: true,
      description: SUBJECT_NAME_DESCRIPTION,
    },
    ...Object.fromEntries(
      REAL_ESTATE_SALES_SECTIONS.map(({ key, description }) => [
        key,
        { type: Type.STRING, nullable: true, description },
      ]),
    ),
  },
  required: ['subjectName', ...REAL_ESTATE_SALES_SECTIONS.map(({ key }) => key)],
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

  async formatSections(
    rawText: string,
  ): Promise<RealEstateSalesFormatterOutput> {
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
    return JSON.parse(text) as RealEstateSalesFormatterOutput;
  }
}
