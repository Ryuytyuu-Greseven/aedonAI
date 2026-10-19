import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { retrieveDeliveryInstallationContext } from '../tool/rag.tools';

// Delivery, Installation & Service — grounded primarily by Pinecone knowledge-base
// retrieval (see vectorsearch.md); falls back to whatever the product's own
// free-text description mentions when the vector DB has nothing.
export async function Delivery_Installation_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('delivery_installation', state.currentLanguage);
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];

  const structuredContext = focusProp
    ? `\n\nProduct: ${focusProp.name}\nDetails on file: ${focusProp.description ?? 'none — speak generally and offer to have the store team share exact delivery, installation and service details.'}`
    : '';
  const customerArea = state.customerAddress ?? state.preferredLocation;
  const cityContext = customerArea ? `\nCustomer city/area: ${customerArea}` : '';

  const lastMsg = state.messages[state.messages.length - 1];
  const userQuery = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const ragContext = focusProp
    ? await retrieveDeliveryInstallationContext(focusProp.name, userQuery, state.agentDetails)
    : null;
  const ragContextBlock = ragContext ? `\n\nAdditional knowledge base context:\n${ragContext}` : '';

  const messages = [
    new SystemMessage(promptText + structuredContext + cityContext + ragContextBlock + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Delivery_Installation_Node' };
}
