import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

export async function Objection_Handling_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('objection_handling', state.currentLanguage);
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];
  const context = focusProp
    ? `\nCurrently discussing: ${focusProp.name}. ${focusProp.description ?? ''}`
    : '';

  const messages = [
    new SystemMessage(promptText + context + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Objection_Handling_Node' };
}
