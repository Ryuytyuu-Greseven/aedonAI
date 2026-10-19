import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { retrieveAmenitiesContext } from '../tool/rag.tools';

// Amenities — grounded primarily by Pinecone knowledge-base retrieval (see
// vectorsearch.md); falls back to whatever the property's own free-text
// description mentions when the vector DB has nothing (e.g. no
// knowledge_base_id linked yet, or PINECONE_API_KEY unset).
export async function Amenities_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('amenities', state.currentLanguage);
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];

  const structuredContext = focusProp
    ? `\n\nProperty: ${focusProp.name}\nDetails on file: ${focusProp.description ?? 'none — speak generally and offer to confirm details with a specialist.'}`
    : '';

  const lastMsg = state.messages[state.messages.length - 1];
  const userQuery = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const ragContext = focusProp
    ? await retrieveAmenitiesContext(focusProp.name, userQuery, state.agentDetails)
    : null;
  const ragContextBlock = ragContext ? `\n\nAdditional knowledge base context:\n${ragContext}` : '';

  const messages = [
    new SystemMessage(promptText + structuredContext + ragContextBlock + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Amenities_Node' };
}
