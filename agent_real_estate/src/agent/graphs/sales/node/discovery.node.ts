import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

// Discovery — the general lead-qualification node. Captures location,
// property type, move-in/purchase timeline, customer name, address, and
// site-visit interest, one missing field at a time.
export async function Discovery_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      customerName: z.string().nullable().describe("Customer's name if mentioned in this message. Null otherwise."),
      customerAddress: z.string().nullable().describe("Customer's current residential address (locality/city is enough) if mentioned in this message. Null otherwise."),
      preferredLocation: z.string().nullable().describe('Preferred city area or locality for the new property. Null if not stated.'),
      preferredType: z.string().nullable().describe('Property type preference: 1BHK, 2BHK, 3BHK, Villa, Studio, etc. Null if not stated.'),
      moveInTimeline: z.string().nullable().describe('When the customer wants to purchase/move in. Null if not stated.'),
      siteVisitInterested: z.boolean().nullable().describe('True/false if the customer just answered whether they would like to visit the site in the coming days. Null if not addressed in this message.'),
      siteVisitPreferredDate: z.string().nullable().describe('The day/time the customer proposed for a site visit, if any (e.g. "this Saturday", "next week"). Null if not stated.'),
      responseToUser: z.string().describe('Conversational response — acknowledge whatever was just shared, then ask the single next missing qualifying question.'),
    }),
    { name: 'extract_preferences' }
  );

  const promptText = await Prompts.getPrompt('discovery', state.currentLanguage);
  const alreadyKnown = [
    state.customerName && `Name: ${state.customerName}`,
    state.customerAddress && `Address: ${state.customerAddress}`,
    state.preferredLocation && `Location: ${state.preferredLocation}`,
    state.preferredType && `Type: ${state.preferredType}`,
    state.moveInTimeline && `Purchase timeline: ${state.moveInTimeline}`,
    state.siteVisitInterested !== null && `Site visit interest: ${state.siteVisitInterested ? 'Yes' : 'No'}`,
    state.siteVisitPreferredDate && `Preferred visit date: ${state.siteVisitPreferredDate}`,
  ].filter(Boolean).join(', ');

  const stillMissing = [
    !state.customerName && 'name',
    !state.customerAddress && 'address',
    !state.moveInTimeline && 'purchase timeline',
    state.siteVisitInterested === null && 'site-visit interest',
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
