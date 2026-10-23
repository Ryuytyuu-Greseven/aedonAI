import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { retrieveNearbyFacilitiesContext } from '../tool/rag.tools';
import { recordProductEnquiry } from '../tool/product-enquiry.store';

// Nearby Facilities — grounded primarily by Pinecone knowledge-base
// retrieval (see vectorsearch.md); falls back to whatever the property's own
// free-text description mentions when the vector DB has nothing.
export async function Nearby_Facilities_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('nearby_facilities', state.currentLanguage);
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];
  // Product Stats: asking what's near a property is an enquiry about it.
  void recordProductEnquiry(state, focusProp, 'discussed');

  const structuredContext = focusProp
    ? `\n\nProperty: ${focusProp.name}\nDetails on file: ${focusProp.description ?? 'none — speak generally and offer to confirm exact landmarks with a specialist.'}`
    : '';

  const lastMsg = state.messages[state.messages.length - 1];
  const userQuery = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const ragContext = focusProp
    ? await retrieveNearbyFacilitiesContext(focusProp.name, userQuery, state.agentDetails)
    : null;
  const ragContextBlock = ragContext ? `\n\nAdditional knowledge base context:\n${ragContext}` : '';

  const messages = [
    new SystemMessage(promptText + structuredContext + ragContextBlock + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Nearby_Facilities_Node' };
}
