import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { lookupFaq } from '../tool/sales.tools';
import { retrievePresentationContext } from '../tool/rag.tools';
import { recordProductEnquiry } from '../tool/product-enquiry.store';

// Presentation — deep-dive on the focus model's free-text description
// (price included — it's baked into the same blob, not a separate field we
// can redact), grounded further by Pinecone knowledge-base retrieval when
// available. Pacing (don't lead with price, build value first) is now a
// prompt instruction rather than a code-enforced gate — see presentation.md.
export async function Model_Presentation_Node(state: SalesState) {
  const properties = state.properties;
  const currentIdx = state.currentPropertyIndex ?? 0;
  const focusProp = properties[currentIdx];

  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      requestedIndex: z
        .number()
        .nullable()
        .describe('0-based index of the motorcycle model the customer is asking about. Null if unclear — keep current.'),
      purchaseIntent: z
        .boolean()
        .describe('True if the customer clearly wants to go ahead with this bike (e.g. "that works for me", "I want this one").'),
      shortlistProperty: z
        .boolean()
        .describe('True if the customer expressed interest in shortlisting this bike for consideration.'),
      responseToUser: z
        .string()
        .describe('Conversational response to the customer, following the phase instructions in the system prompt.'),
    }),
    { name: 'extract_presentation' }
  );

  const propertyListContext = properties.map((p, i) => `[${i + 1}] ${p.name}`).join('\n');

  const focusContext = focusProp
    ? `\n\nCurrently discussing: Model ${currentIdx + 1} — ${focusProp.name}` +
      `\nDetails: ${focusProp.description ?? 'No further details on file — speak generally and offer to have the showroom team confirm specifics.'}`
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

  const promptText = await Prompts.getPrompt('model_presentation', state.currentLanguage);

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nAll available models:\n${propertyListContext}` +
      focusContext +
      kbContext +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Model_Presentation_Node',
  };

  if (result.requestedIndex !== null && result.requestedIndex >= 0 && result.requestedIndex < properties.length) {
    updates.currentPropertyIndex = result.requestedIndex;
  }

  // Product Stats: the model presented this turn, plus the one the customer
  // just asked about if they switched.
  void recordProductEnquiry(state, focusProp, 'discussed');
  if (updates.currentPropertyIndex !== undefined && updates.currentPropertyIndex !== currentIdx) {
    void recordProductEnquiry(state, properties[updates.currentPropertyIndex], 'discussed');
  }

  if (result.purchaseIntent && focusProp) {
    updates.purchaseIntentPropertyId = focusProp.id;
    void recordProductEnquiry(state, focusProp, 'purchase_intent');
  }

  if (result.shortlistProperty && focusProp) {
    void recordProductEnquiry(state, focusProp, 'shortlisted');
    const alreadyShortlisted = state.shortlistedPropertyIds.includes(focusProp.id);
    if (!alreadyShortlisted) {
      updates.shortlistedPropertyIds = [...state.shortlistedPropertyIds, focusProp.id];
    }
  }

  return updates;
}
