import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { lookupFaq } from '../tool/sales.tools';
import { retrievePresentationContext } from '../tool/rag.tools';
import { recordProductEnquiry } from '../tool/product-enquiry.store';

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
      customerName: z
        .string()
        .nullable()
        .describe("Customer's name if mentioned or introduced. Null otherwise."),
      customerEmail: z
        .string()
        .nullable()
        .describe("Customer's email address if shared for brochure, floor plans, or pricing details. Null otherwise."),
      customerPhNo: z
        .string()
        .nullable()
        .describe("Customer's phone number if shared for follow-up or WhatsApp. Null otherwise."),
      preferredContactMethod: z
        .string()
        .nullable()
        .describe("Preferred contact method if stated ('phone', 'whatsapp', 'email'). Null otherwise."),
      responseToUser: z
        .string()
        .describe(
          'Conversational response to the customer, following the phase instructions in the system prompt. ' +
          'If the customer requests brochures or floor plans, offer to send via WhatsApp or ask for their email address. ' +
          'If customer just gave their name, acknowledge warmly: "Nice to meet you, [Name].". ' +
          'Maintain a calm, steady vocal delivery without exclamation marks.',
        ),
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
      Prompts.customerProfileContext(state) +
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

  if (result.customerName && !state.customerName) updates.customerName = result.customerName;
  if (result.customerEmail && !state.customerEmail) updates.customerEmail = result.customerEmail;
  if (result.customerPhNo && !state.customerPhNo) updates.customerPhNo = result.customerPhNo;
  if (result.preferredContactMethod && !state.preferredContactMethod) updates.preferredContactMethod = result.preferredContactMethod;

  // Product Stats: the property presented this turn, plus the one the customer
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
