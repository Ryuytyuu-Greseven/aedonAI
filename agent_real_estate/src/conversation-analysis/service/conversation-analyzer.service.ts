import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { getAnalysisLlm } from '../llm/analysis-llm.provider.js';
import { ANALYSIS_SYSTEM_PROMPT } from '../prompt/analysis.prompt.js';
import { ConversationTurn } from '../types.js';

const AnalysisResultSchema = z.object({
  summary: z.string(),
  interested: z.boolean(),
  wantsFurtherContact: z.boolean(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  budgetMentioned: z.string().nullable(),
  propertiesDiscussed: z.array(z.string()),
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

export async function analyzeConversation(transcript: ConversationTurn[]): Promise<AnalysisResult> {
  const extractorLlm = getAnalysisLlm().withStructuredOutput(AnalysisResultSchema, {
    name: 'analyze_conversation',
  });

  const result = await extractorLlm.invoke([
    new SystemMessage(ANALYSIS_SYSTEM_PROMPT),
    new HumanMessage(`Transcript:\n\n${formatTranscript(transcript)}`),
  ]);

  return result;
}
