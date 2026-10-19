import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { formatPrice } from '../tool/sales.tools';

export async function Budget_Discovery_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      budgetMin: z.number().nullable().describe('Minimum budget in INR. Null if not stated.'),
      budgetMax: z.number().nullable().describe('Maximum budget in INR. Null if not stated.'),
      preferredLocation: z.string().nullable().describe('Preferred city area or locality. Null if not stated.'),
      customerName: z.string().nullable().describe("Customer's first name if mentioned. Null otherwise."),
      responseToUser: z.string().describe('Conversational response — acknowledge the budget/location or ask for whichever is still missing.'),
    }),
    { name: 'extract_budget' }
  );

  const promptText = await Prompts.getPrompt('budget_discovery', state.currentLanguage);
  const currentBudget =
    state.budgetMin !== null || state.budgetMax !== null
      ? `\nBudget captured so far — Min: ${state.budgetMin ? formatPrice(state.budgetMin) : 'not stated'}, Max: ${state.budgetMax ? formatPrice(state.budgetMax) : 'not stated'}`
      : '';
  const currentLocation = state.preferredLocation
    ? `\nPreferred location captured so far: ${state.preferredLocation}`
    : '';

  const messages = [
    new SystemMessage(promptText + currentBudget + currentLocation + Prompts.identityContext(state)),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: Partial<SalesState> & { messages: AIMessage[] } = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Budget_Discovery_Node',
  };

  if (result.budgetMin !== null) updates.budgetMin = result.budgetMin;
  if (result.budgetMax !== null) updates.budgetMax = result.budgetMax;
  if (result.preferredLocation) updates.preferredLocation = result.preferredLocation;
  if (result.customerName) updates.customerName = result.customerName;

  return updates;
}
