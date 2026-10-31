import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

// Discovery — the general lead-qualification node. Captures city/area,
// bike type/riding use, purchase timeline, customer name, and test-ride
// interest, one missing field at a time. (State fields keep their original
// real-estate names: customerAddress = city/area, siteVisit* = test ride.)
export async function Discovery_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      customerName: z.string().nullable().describe("Customer's name if mentioned in this message. Null otherwise."),
      customerAddress: z.string().nullable().describe("Customer's city or area of residence (locality/city is enough) if mentioned in this message. Null otherwise."),
      preferredLocation: z.string().nullable().describe('City/area where the customer wants to buy or visit a showroom, if different from where they live. Null if not stated.'),
      preferredType: z.string().nullable().describe('Preferred bike type/segment (commuter, scooter, sports, cruiser, adventure, electric, or a specific model), optionally with the main riding use — e.g. "commuter for daily office rides". Null if not stated.'),
      ridingUsage: z.string().nullable().describe('Main riding purpose: daily commute, long-distance touring, college, or casual city rides. Null if not stated.'),
      hasExchangeBike: z.boolean().nullable().describe('True if customer mentioned exchanging their existing two-wheeler. False if no exchange. Null if not addressed.'),
      interestedInFinance: z.boolean().nullable().describe('True if customer is asking about or interested in EMI / bike financing. Null if not addressed.'),
      moveInTimeline: z.string().nullable().describe('When the customer wants to buy the bike (e.g. this week, this month, during upcoming festival). Null if not stated.'),
      siteVisitInterested: z.boolean().nullable().describe('True/false if the customer just answered whether they would like to take a test ride / visit the showroom in the coming days. Null if not addressed in this message.'),
      siteVisitPreferredDate: z.string().nullable().describe('The day/time the customer proposed for a test ride / showroom visit, if any (e.g. "this Saturday", "tomorrow afternoon"). Null if not stated.'),
      responseToUser: z.string().describe('Conversational response — acknowledge whatever was just shared warmly in 1-2 short spoken sentences, then ask the single next missing qualifying question.'),
    }),
    { name: 'extract_preferences' }
  );

  const promptText = await Prompts.getPrompt('discovery', state.currentLanguage);
  const alreadyKnown = [
    state.customerName && `Name: ${state.customerName}`,
    state.customerAddress && `City/area: ${state.customerAddress}`,
    state.preferredLocation && `Preferred showroom area: ${state.preferredLocation}`,
    state.preferredType && `Bike type: ${state.preferredType}`,
    state.ridingUsage && `Riding purpose: ${state.ridingUsage}`,
    state.hasExchangeBike !== null && `Exchange old bike: ${state.hasExchangeBike ? 'Yes' : 'No'}`,
    state.interestedInFinance !== null && `Finance/EMI interest: ${state.interestedInFinance ? 'Yes' : 'No'}`,
    state.moveInTimeline && `Purchase timeline: ${state.moveInTimeline}`,
    state.siteVisitInterested !== null && `Test-ride interest: ${state.siteVisitInterested ? 'Yes' : 'No'}`,
    state.siteVisitPreferredDate && `Preferred test-ride date: ${state.siteVisitPreferredDate}`,
  ].filter(Boolean).join(', ');

  const stillMissing = [
    !state.customerName && 'name',
    !state.customerAddress && 'city/area (for finding nearest showroom)',
    !state.preferredType && !state.ridingUsage && 'riding usage or preferred bike category',
    !state.moveInTimeline && 'purchase timeline',
    state.siteVisitInterested === null && 'test-ride interest',
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
  if (result.ridingUsage) updates.ridingUsage = result.ridingUsage;
  if (result.hasExchangeBike !== null && result.hasExchangeBike !== undefined) updates.hasExchangeBike = result.hasExchangeBike;
  if (result.interestedInFinance !== null && result.interestedInFinance !== undefined) updates.interestedInFinance = result.interestedInFinance;
  if (result.moveInTimeline) updates.moveInTimeline = result.moveInTimeline;
  if (result.siteVisitInterested !== null) updates.siteVisitInterested = result.siteVisitInterested;
  if (result.siteVisitPreferredDate) updates.siteVisitPreferredDate = result.siteVisitPreferredDate;

  return updates;
}
