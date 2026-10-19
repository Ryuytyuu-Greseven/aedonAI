import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { lookupFaq } from '../tool/sales.tools';
import { retrieveFaqContext } from '../tool/rag.tools';

// FAQ — Pinecone knowledge-base retrieval when configured (see
// vectorsearch.md), falling back to the static keyword lookup below until
// PINECONE_API_KEY / PINECONE_INDEX / EMBEDDING_PROVIDER are set and the
// agent has knowledge_base_ids linked — once configured, this switches over
// with no further code changes.
export async function FAQ_Node(state: SalesState) {
  const lastMsg = state.messages[state.messages.length - 1];
  const query = typeof lastMsg?.content === 'string' ? lastMsg.content : '';

  const [ragContext, faqAnswer] = await Promise.all([
    retrieveFaqContext(query, state.agentDetails),
    Promise.resolve(lookupFaq(query)),
  ]);
  const promptText = await Prompts.getPrompt('faq_rag', state.currentLanguage);

  const faqContext = ragContext
    ? `\n\nRelevant knowledge base excerpts:\n${ragContext}`
    : faqAnswer
      ? `\n\nRelevant answer from knowledge base: ${faqAnswer}`
      : '\n\nNo specific answer found in the knowledge base. Offer to connect the customer with a property specialist.';

  const messages = [
    new SystemMessage(promptText + faqContext + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'FAQ_Node' };
}
