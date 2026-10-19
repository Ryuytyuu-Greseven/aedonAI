import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { lookupFaq } from '../tool/sales.tools';
import { retrievePresentationContext } from '../tool/rag.tools';

// Presentation — deep-dive on the focus property's free-text description
// (price included — it's baked into the same blob, not a separate field we
// can redact), grounded further by Pinecone knowledge-base retrieval when
// available. Pacing (don't lead with price, build value first) is now a
// prompt instruction rather than a code-enforced gate — see presentation.md.
export async function Presentation_Node(state: SalesState) {
  const properties = state.properties;
  const currentIdx = state.currentPropertyIndex ?? 0;
  const focusProp = properties[currentIdx];

  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      requestedIndex: z
        .number()
        .nullable()
        .describe('0-based index of the property the customer is asking about. Null if unclear — keep current.'),
      purchaseIntent: z
        .boolean()
        .describe('True if the customer clearly wants to proceed with this property (e.g. "that works for me", "let\'s go with this one").'),
      shortlistProperty: z
        .boolean()
        .describe('True if the customer expressed interest in saving or shortlisting this property for consideration.'),
      responseToUser: z
        .string()
        .describe('Conversational response to the customer, following the phase instructions in the system prompt.'),
    }),
    { name: 'extract_presentation' }
  );

  const propertyListContext = properties.map((p, i) => `[${i + 1}] ${p.name}`).join('\n');

  const focusContext = focusProp
    ? `\n\nCurrently discussing: Property ${currentIdx + 1} — ${focusProp.name}` +
      `\nDetails: ${focusProp.description ?? 'No further details on file — speak generally and offer to confirm specifics with a specialist.'}`
    : '';

  const lastMsg = state.messages[state.messages.length - 1];
  const lastQuery = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const [ragAnswer, faqAnswer] = await Promise.all([
    focusProp ? retrievePresentationContext(focusProp.name, lastQuery, state.agentDetails) : Promise.resolve(null),
    Promise.resolve(lookupFaq(lastQuery)),
  ]);
  const kbContext = ragAnswer
    ? `\n\nRelevant knowledge base context for their question:\n${ragAnswer}`
    : faqAnswer
      ? `\n\nRelevant knowledge base fact for their question: ${faqAnswer}`
      : '';

  const promptText = await Prompts.getPrompt('presentation', state.currentLanguage);

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nAll available properties:\n${propertyListContext}` +
      focusContext +
      kbContext +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Presentation_Node',
  };

  if (result.requestedIndex !== null && result.requestedIndex >= 0 && result.requestedIndex < properties.length) {
    updates.currentPropertyIndex = result.requestedIndex;
  }

  if (result.purchaseIntent && focusProp) {
    updates.purchaseIntentPropertyId = focusProp.id;
  }

  if (result.shortlistProperty && focusProp) {
    const alreadyShortlisted = state.shortlistedPropertyIds.includes(focusProp.id);
    if (!alreadyShortlisted) {
      updates.shortlistedPropertyIds = [...state.shortlistedPropertyIds, focusProp.id];
    }
  }

  return updates;
}
