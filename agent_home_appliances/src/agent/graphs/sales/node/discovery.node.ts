import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

// Discovery — the general lead-qualification node. Captures city/area,
// product category + need, purchase timeline, customer name, and store-visit
// interest, one missing field at a time. (State fields keep their original
// real-estate names: customerAddress = city/area, preferredType = product
// need, siteVisit* = store visit.)
export async function Discovery_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      customerName: z.string().nullable().describe("Customer's name if mentioned in this message. Null otherwise."),
      customerAddress: z.string().nullable().describe("Customer's city or area of residence (locality/city is enough) if mentioned in this message. Null otherwise."),
      preferredLocation: z.string().nullable().describe('City/area where the customer wants to visit a store or have the product delivered, if different from where they live. Null if not stated.'),
      preferredType: z.string().nullable().describe('Product category the customer wants (refrigerator, washing machine, AC, TV, microwave, dishwasher, vacuum, etc.) plus the need behind it if stated — e.g. "refrigerator, family of 5, replacing an old one" or "AC for a 150 sq ft bedroom". Null if not stated.'),
      moveInTimeline: z.string().nullable().describe('When the customer wants to buy (e.g. this week, festival sale, when moving house). Null if not stated.'),
      siteVisitInterested: z.boolean().nullable().describe('True/false if the customer just answered whether they would like to visit the store for a demo in the coming days. Null if not addressed in this message.'),
      siteVisitPreferredDate: z.string().nullable().describe('The day/time the customer proposed for a store visit, if any (e.g. "this Saturday", "next week"). Null if not stated.'),
      responseToUser: z.string().describe('Conversational response — acknowledge whatever was just shared, then ask the single next missing qualifying question.'),
    }),
    { name: 'extract_preferences' }
  );

  const promptText = await Prompts.getPrompt('discovery', state.currentLanguage);
  const alreadyKnown = [
    state.customerName && `Name: ${state.customerName}`,
    state.customerAddress && `City/area: ${state.customerAddress}`,
    state.preferredLocation && `Preferred store/delivery area: ${state.preferredLocation}`,
    state.preferredType && `Looking for: ${state.preferredType}`,
    state.moveInTimeline && `Purchase timeline: ${state.moveInTimeline}`,
    state.siteVisitInterested !== null && `Store-visit interest: ${state.siteVisitInterested ? 'Yes' : 'No'}`,
    state.siteVisitPreferredDate && `Preferred store-visit date: ${state.siteVisitPreferredDate}`,
  ].filter(Boolean).join(', ');

  const stillMissing = [
    !state.customerName && 'name',
    !state.customerAddress && 'city/area',
    !state.moveInTimeline && 'purchase timeline',
    state.siteVisitInterested === null && 'store-visit interest',
  ].filter(Boolean).join(', ');

  const messages = [
    new SystemMessage(
      promptText +
      (alreadyKnown ? `\n\nAlready captured: ${alreadyKnown}` : '') +
      (stillMissing ? `\n\nStill missing (ask for ONE of these next, whichever fits the conversation best): ${stillMissing}` : '') +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Discovery_Node',
  };

  if (result.customerName) updates.customerName = result.customerName;
  if (result.customerAddress) updates.customerAddress = result.customerAddress;
  if (result.preferredLocation) updates.preferredLocation = result.preferredLocation;
  if (result.preferredType) updates.preferredType = result.preferredType;
  if (result.moveInTimeline) updates.moveInTimeline = result.moveInTimeline;
  if (result.siteVisitInterested !== null) updates.siteVisitInterested = result.siteVisitInterested;
  if (result.siteVisitPreferredDate) updates.siteVisitPreferredDate = result.siteVisitPreferredDate;

  return updates;
}
