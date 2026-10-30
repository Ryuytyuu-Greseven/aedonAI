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
      preferredType: z.string().nullable().describe('Property configuration preference if mentioned (e.g. 2BHK, 3BHK). Null if not stated.'),
      customerName: z.string().nullable().describe("Customer's name if mentioned or volunteered. Null otherwise."),
      customerEmail: z.string().nullable().describe("Customer's email address if shared. Null otherwise."),
      customerPhNo: z.string().nullable().describe("Customer's phone number if shared. Null otherwise."),
      preferredContactMethod: z.string().nullable().describe("Preferred contact method if stated ('phone', 'whatsapp', 'email'). Null otherwise."),
      responseToUser: z.string().describe(
        'Conversational response — acknowledge the budget/location warmly. ' +
        'If customer name is missing, ask for their name naturally: "Got it, I\'ll focus on [type] options around [location] within your budget. By the way, may I know your name so I can personalize our conversation?". ' +
        'If customer name is already known, personalize with their name and do NOT ask for their name again.',
      ),
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
  const currentType = state.preferredType
    ? `\nProperty configuration captured so far: ${state.preferredType}`
    : '';

  const nameGuidance = !state.customerName
    ? `\n\nNAME COLLECTION OPPORTUNITY: Customer's name is NOT yet known. Acknowledge their requirements/budget warmly and ask for their name naturally to personalize: "Got it, I'll focus on ${state.preferredType ?? 'options'} around ${state.preferredLocation ?? 'your preferred area'} within your budget. By the way, may I know your name so I can personalize our conversation?"`
    : `\n\nCUSTOMER NAME ALREADY KNOWN: Customer's name is "${state.customerName}". Address them by name and do NOT ask for their name again.`;

  const messages = [
    new SystemMessage(
      promptText +
      currentBudget +
      currentLocation +
      currentType +
      nameGuidance +
      Prompts.customerProfileContext(state) +
      Prompts.identityContext(state),
    ),
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
  if (result.preferredType) updates.preferredType = result.preferredType;
  if (result.customerName) updates.customerName = result.customerName;
  if (result.customerEmail) updates.customerEmail = result.customerEmail;
  if (result.customerPhNo) updates.customerPhNo = result.customerPhNo;
  if (result.preferredContactMethod) updates.preferredContactMethod = result.preferredContactMethod;

  return updates;
}
