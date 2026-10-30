import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state.js';
import { llmInstance } from './../../../llms/google.llm.js';
import * as Prompts from '../prompt/sales.prompts.js';

export async function Greeting_Pitch_Node(state: SalesState) {
  const configuredGreeting = state.agentDetails?.greeting?.trim();
  const lastMsg = state.messages[state.messages.length - 1];
  const isSystemStart =
    state.userQuery === 'SYSTEM_START_CONVERSATION' ||
    lastMsg?.content === 'SYSTEM_START_CONVERSATION';

  // If the agent has a configured initial greeting and the call is starting,
  // deliver the configured greeting directly (preserves user configuration and eliminates LLM latency).
  if (configuredGreeting && isSystemStart) {
    return {
      messages: [new AIMessage(configuredGreeting)],
      currentNode: 'Greeting_Pitch_Node',
    };
  }

  const promptText = await Prompts.getPrompt('greeting', state.currentLanguage);

  const messages = [
    new SystemMessage(promptText + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Greeting_Pitch_Node' };
}
