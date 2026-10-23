import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { retrieveSpecsFeaturesContext } from '../tool/rag.tools';
import { recordProductEnquiry } from '../tool/product-enquiry.store';

// Specs & Features — grounded primarily by Pinecone knowledge-base retrieval (see
// vectorsearch.md); falls back to whatever the product's own free-text
// description mentions when the vector DB has nothing (e.g. no
// knowledge_base_id linked yet, or PINECONE_API_KEY unset).
export async function Specs_Features_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('specs_features', state.currentLanguage);
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];
  // Product Stats: asking about a product's specs is an enquiry about it.
  void recordProductEnquiry(state, focusProp, 'discussed');

  const structuredContext = focusProp
    ? `\n\nProduct: ${focusProp.name}\nDetails on file: ${focusProp.description ?? 'none — speak generally and offer to have the store team confirm details.'}`
    : '';

  const lastMsg = state.messages[state.messages.length - 1];
  const userQuery = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const ragContext = focusProp
    ? await retrieveSpecsFeaturesContext(focusProp.name, userQuery, state.agentDetails)
    : null;
  const ragContextBlock = ragContext ? `\n\nAdditional knowledge base context:\n${ragContext}` : '';

  const messages = [
    new SystemMessage(promptText + structuredContext + ragContextBlock + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Specs_Features_Node' };
}
