import { EmbeddingProviderName } from '../../../common/interfaces/knowledge-base-embedding.interface';
import { RealEstateSalesFormatterOutput } from '../../sales/real-estate-sales.profile';

/**
 * Reformats a document/url's raw extracted text into a fixed set of
 * sections via an LLM, before it's chunked/embedded. Concrete to the
 * `RealEstateSalesFormatterOutput` schema for now — see
 * `src/knowledge-bases/sales/real-estate-sales.profile.ts` — until
 * agent-type-based profiles are introduced.
 */
export interface TextFormatterProvider {
  readonly name: EmbeddingProviderName;
  formatSections(rawText: string): Promise<RealEstateSalesFormatterOutput>;
}
