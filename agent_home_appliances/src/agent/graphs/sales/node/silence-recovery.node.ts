import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

export async function Silence_Recovery_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('silence', state.currentLanguage);
  const messages = [
    new SystemMessage(promptText + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Silence_Recovery_Node' };
}
