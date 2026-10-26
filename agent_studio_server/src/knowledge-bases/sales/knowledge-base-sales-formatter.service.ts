import { Inject, Injectable, Logger } from '@nestjs/common';
import { TEXT_FORMATTER_PROVIDER_TOKEN } from '../embeddings/formatting/text-formatter-provider.factory';
import { TextFormatterProvider } from '../embeddings/formatting/text-formatter.interface';
import {
  FormattedSalesDocument,
  toFormattedSalesDocument,
} from './real-estate-sales.profile';

/**
 * Reformats a knowledge base source's raw extracted text into the
 * real-estate sales section layout before it's chunked/embedded — the
 * "knowledge base sales service". Agent type is hardcoded to
 * `real_estate_sales` for now; see real-estate-sales.profile.ts for the
 * section schema and prompt.
 */
@Injectable()
export class KnowledgeBaseSalesFormatterService {
  private readonly logger = new Logger(KnowledgeBaseSalesFormatterService.name);

  constructor(
    @Inject(TEXT_FORMATTER_PROVIDER_TOKEN)
    private readonly formatter: TextFormatterProvider,
  ) {}

  /**
   * Returns null if formatting fails outright, or if the model found no
   * content matching any section (e.g. an unrelated upload) — the caller
   * then indexes the raw text instead, so a document never ends up
   * completely unsearchable because of this step.
   */
  async format(rawText: string): Promise<FormattedSalesDocument | null> {
    try {
      const output = await this.formatter.formatSections(rawText);
      const document = toFormattedSalesDocument(output);
      return document.sections.length > 0 ? document : null;
    } catch (error) {
      this.logger.warn(
        `Sales formatting failed, falling back to raw text: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
