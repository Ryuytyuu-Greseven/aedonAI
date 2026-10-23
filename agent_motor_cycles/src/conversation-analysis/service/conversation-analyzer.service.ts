import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getAnalysisLlm } from '../llm/analysis-llm.provider.js';
import { ANALYSIS_SYSTEM_PROMPT } from '../prompt/analysis.prompt.js';
import { ConversationTurn } from '../types.js';
import { CatalogueProduct } from '../repository/product-catalogue.repository.js';

const AnalysisResultSchema = z.object({
  summary: z.string(),
  interested: z.boolean(),
  wantsFurtherContact: z.boolean(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  budgetMentioned: z.string().nullable(),
  propertiesDiscussed: z.array(z.string()),
  propertiesDiscussedIds: z
    .array(z.string())
    .describe('Catalogue ids (from the provided catalogue) of the products in propertiesDiscussed. Empty if none match the catalogue.'),
  amenitiesOrFacilitiesRequested: z.array(z.string()),
  otherInterests: z.array(z.string()),
  nextSteps: z.string().nullable(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

function formatTranscript(transcript: ConversationTurn[]): string {
  return transcript
    .map((turn) => `${turn.speaker === 'agent' ? 'Agent' : 'Customer'}: ${turn.text}`)
    .join('\n');
}

function formatCatalogue(catalogue: CatalogueProduct[]): string {
  if (catalogue.length === 0) return 'Product catalogue: (none on file — return an empty propertiesDiscussedIds)';
  return `Product catalogue (id — name):\n${catalogue.map((p) => `${p.id} — ${p.name}`).join('\n')}`;
}

export async function analyzeConversation(
  transcript: ConversationTurn[],
  catalogue: CatalogueProduct[] = [],
): Promise<AnalysisResult> {
  const extractorLlm = getAnalysisLlm().withStructuredOutput(AnalysisResultSchema, {
    name: 'analyze_conversation',
  });

  const result = await extractorLlm.invoke([
    new SystemMessage(ANALYSIS_SYSTEM_PROMPT),
    new HumanMessage(`${formatCatalogue(catalogue)}\n\nTranscript:\n\n${formatTranscript(transcript)}`),
  ]);

  // Drop anything that isn't a real catalogue id (hallucinated or mangled).
  const knownIds = new Set(catalogue.map((p) => p.id));
  return {
    ...result,
    propertiesDiscussedIds: [...new Set(result.propertiesDiscussedIds ?? [])].filter((id) => knownIds.has(id)),
  };
}
