import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

// Discovery — the consultative lead-qualification node. Captures buyer intent
// (family living vs investment), configuration (2BHK, 3BHK, Villa),
// preferred locality, and move-in timeline without interrogating caller for
// residential address.
export async function Discovery_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      buyerType: z
        .enum(['end_user', 'investor'])
        .nullable()
        .describe("Whether the property is for personal/family living ('end_user') or investment ('investor'). Null if not mentioned."),
      preferredType: z
        .string()
        .nullable()
        .describe('Property configuration preference: 2BHK, 3BHK, 4BHK, Villa, Penthouse, etc. Null if not stated.'),
      preferredLocation: z
        .string()
        .nullable()
        .describe('Preferred city area or locality (e.g. Whitefield, Sarjapur, North Bangalore). Null if not stated.'),
      moveInTimeline: z
        .string()
        .nullable()
        .describe('When the customer wants to move in (ready-to-move vs under-construction). Null if not stated.'),
      customerName: z
        .string()
        .nullable()
        .describe("Customer's name if mentioned or volunteered in this message. Null otherwise."),
      customerAddress: z
        .string()
        .nullable()
        .describe("Customer's address only if volunteered. Do not ask for it in this phase. Null otherwise."),
      siteVisitInterested: z
        .boolean()
        .nullable()
        .describe('True/false if the customer expressed interest in visiting the property site. Null if not mentioned.'),
      siteVisitPreferredDate: z
        .string()
        .nullable()
        .describe('Day or timeframe proposed for site visit, if any (e.g. "Saturday", "this weekend"). Null if not stated.'),
      responseToUser: z
        .string()
        .describe('Conversational spoken response — acknowledge their requirements warmly, then ask ONE natural next question.'),
    }),
    { name: 'extract_preferences' }
  );

  const promptText = await Prompts.getPrompt('discovery', state.currentLanguage);
  const alreadyKnown = [
    state.customerName && `Name: ${state.customerName}`,
    state.buyerType && `Buyer type: ${state.buyerType === 'end_user' ? 'Family living' : 'Investment'}`,
    state.preferredType && `Configuration: ${state.preferredType}`,
    state.preferredLocation && `Location: ${state.preferredLocation}`,
    state.moveInTimeline && `Timeline: ${state.moveInTimeline}`,
    state.siteVisitInterested !== null && `Site visit interest: ${state.siteVisitInterested ? 'Yes' : 'No'}`,
  ].filter(Boolean).join(', ');

  const stillMissing = [
    !state.buyerType && 'purpose (family living vs investment)',
    !state.preferredType && 'configuration (2BHK, 3BHK, Villa)',
    !state.preferredLocation && 'preferred locality or commute area',
    !state.moveInTimeline && 'possession timeline (ready vs under-construction)',
  ].filter(Boolean).join(', ');

  const messages = [
    new SystemMessage(
      promptText +
      (alreadyKnown ? `\n\nAlready captured: ${alreadyKnown}` : '') +
      (stillMissing ? `\n\nStill discovering (ask for ONE of these next, whichever flows most naturally): ${stillMissing}` : '') +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Discovery_Node',
  };

  if (result.buyerType) updates.buyerType = result.buyerType;
  if (result.preferredType) updates.preferredType = result.preferredType;
  if (result.preferredLocation) updates.preferredLocation = result.preferredLocation;
  if (result.moveInTimeline) updates.moveInTimeline = result.moveInTimeline;
  if (result.customerName) updates.customerName = result.customerName;
  if (result.customerAddress) updates.customerAddress = result.customerAddress;
  if (result.siteVisitInterested !== null) updates.siteVisitInterested = result.siteVisitInterested;
  if (result.siteVisitPreferredDate) updates.siteVisitPreferredDate = result.siteVisitPreferredDate;

  return updates;
}
