import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmbeddingProviderName } from '../../../../common/interfaces/knowledge-base-embedding.interface';
import {
  REAL_ESTATE_SALES_SECTIONS,
  REAL_ESTATE_SALES_PROMPT,
  RealEstateSalesFormatterOutput,
  SUBJECT_NAME_DESCRIPTION,
} from '../../../sales/real-estate-sales.profile';
import { TextFormatterProvider } from '../text-formatter.interface';

const DEFAULT_MODEL = 'gpt-4o-mini';

/** JSON Schema for OpenAI's strict structured-output mode: the subject and
 * every section are nullable strings, and every property must be listed as
 * `required`. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    subjectName: {
      type: ['string', 'null'],
      description: SUBJECT_NAME_DESCRIPTION,
    },
    ...Object.fromEntries(
      REAL_ESTATE_SALES_SECTIONS.map(({ key, description }) => [
        key,
        { type: ['string', 'null'], description },
      ]),
    ),
  },
  required: ['subjectName', ...REAL_ESTATE_SALES_SECTIONS.map(({ key }) => key)],
  additionalProperties: false,
};

export class OpenAiTextFormatterProvider implements TextFormatterProvider {
  readonly name: EmbeddingProviderName = 'openai';
  private readonly model: string;
  private readonly client: OpenAI;

  constructor(config: ConfigService) {
    this.model = config.get<string>('OPENAI_CHAT_MODEL') ?? DEFAULT_MODEL;
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async formatSections(
    rawText: string,
  ): Promise<RealEstateSalesFormatterOutput> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: REAL_ESTATE_SALES_PROMPT.replace('{{RAW_TEXT}}', rawText),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'real_estate_sales_sections',
          schema: RESPONSE_SCHEMA,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error('OpenAI returned no content for sales formatting');
    }
    return JSON.parse(content) as RealEstateSalesFormatterOutput;
  }
}
