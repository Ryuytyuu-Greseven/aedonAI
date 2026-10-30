import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

export async function Objection_Handling_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('objection_handling', state.currentLanguage);
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];
  const propContext = focusProp
    ? `\nCurrently discussing: ${focusProp.name}. ${focusProp.description ?? ''}`
    : '';

  const customerContext = [
    state.buyerType && `Buyer intent: ${state.buyerType === 'end_user' ? 'Family living' : 'Investment'}`,
    (state.budgetMin || state.budgetMax) && `Budget: ${state.budgetMin ?? 0} to ${state.budgetMax ?? 'not specified'}`,
    state.preferredLocation && `Preferred location: ${state.preferredLocation}`,
    state.preferredType && `Preferred unit: ${state.preferredType}`,
  ].filter(Boolean).join(' | ');

  const messages = [
    new SystemMessage(
      promptText +
      propContext +
      (customerContext ? `\nCustomer context: ${customerContext}` : '') +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Objection_Handling_Node' };
}
