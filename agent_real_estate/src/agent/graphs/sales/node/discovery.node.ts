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
        .enum(['end_user', 'investor', 'renter', 'undecided'])
        .nullable()
        .describe("Whether the customer is looking for buying for personal/family living ('end_user'), investment ('investor'), renting ('renter'), or exploring/undecided ('undecided'). Null if not mentioned."),
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
      budgetMin: z
        .number()
        .nullable()
        .describe('Minimum budget in INR if mentioned. Null if not stated.'),
      budgetMax: z
        .number()
        .nullable()
        .describe('Maximum budget in INR if mentioned. Null if not stated.'),
      customerName: z
        .string()
        .nullable()
        .describe("Customer's name if mentioned or volunteered in this message. Null otherwise."),
      customerEmail: z
        .string()
        .nullable()
        .describe("Customer's email address if shared. Null otherwise."),
      customerPhNo: z
        .string()
        .nullable()
        .describe("Customer's phone number if shared. Null otherwise."),
      preferredContactMethod: z
        .string()
        .nullable()
        .describe("Preferred contact method if stated ('phone', 'whatsapp', 'email'). Null otherwise."),
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
        .describe(
          'Conversational spoken response — acknowledge requirements warmly and ask ONE natural next question. ' +
          'If the customer just shared their name, acknowledge warmly: "Nice to meet you, [Name]!". ' +
          'If requirements (like BHK/location) are emerging and customer name is still missing, you may ask naturally: "By the way, may I know your name so I can personalize our conversation?". ' +
          'Never ask for phone or email unless arranging a site visit, callback, or brochure delivery.',
        ),
    }),
    { name: 'extract_preferences' }
  );

  const promptText = await Prompts.getPrompt('discovery', state.currentLanguage);
  const alreadyKnown = [
    state.customerName && `Name: ${state.customerName}`,
    state.buyerType && `Buyer type: ${state.buyerType === 'end_user' ? 'Family living' : state.buyerType === 'investor' ? 'Investment' : state.buyerType}`,
    state.preferredType && `Configuration: ${state.preferredType}`,
    state.preferredLocation && `Location: ${state.preferredLocation}`,
    state.moveInTimeline && `Timeline: ${state.moveInTimeline}`,
    (state.budgetMin !== null || state.budgetMax !== null) && `Budget: ${state.budgetMin ?? 0} to ${state.budgetMax ?? 999999999}`,
    state.siteVisitInterested !== null && `Site visit interest: ${state.siteVisitInterested ? 'Yes' : 'No'}`,
  ].filter(Boolean).join(', ');

  const stillMissing = [
    !state.customerName && 'customer name (ask naturally if requirements are emerging to personalize)',
    !state.buyerType && 'purpose (buying for living vs investment vs renting)',
    !state.preferredType && 'configuration (2BHK, 3BHK, Villa)',
    !state.preferredLocation && 'preferred locality or commute area',
    !state.moveInTimeline && 'possession timeline (ready vs under-construction)',
  ].filter(Boolean).join(', ');

  const messages = [
    new SystemMessage(
      promptText +
      (alreadyKnown ? `\n\nAlready captured: ${alreadyKnown}` : '') +
      (stillMissing ? `\n\nStill discovering (ask for ONE of these next, whichever flows most naturally): ${stillMissing}` : '') +
      Prompts.customerProfileContext(state) +
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
  if (result.budgetMin !== null && result.budgetMin !== undefined) updates.budgetMin = result.budgetMin;
  if (result.budgetMax !== null && result.budgetMax !== undefined) updates.budgetMax = result.budgetMax;
  if (result.customerName) updates.customerName = result.customerName;
  if (result.customerEmail) updates.customerEmail = result.customerEmail;
  if (result.customerPhNo) updates.customerPhNo = result.customerPhNo;
  if (result.preferredContactMethod) updates.preferredContactMethod = result.preferredContactMethod;
  if (result.customerAddress) updates.customerAddress = result.customerAddress;
  if (result.siteVisitInterested !== null) updates.siteVisitInterested = result.siteVisitInterested;
  if (result.siteVisitPreferredDate) updates.siteVisitPreferredDate = result.siteVisitPreferredDate;

  return updates;
}
