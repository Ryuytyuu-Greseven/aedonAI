import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { raiseServiceRequestTicket, saveLeadToCrm } from '../tool/sales.tools';

// Closing — final confirmation on the disclosed price, then (if not already
// captured during Discovery_Node) ask when the customer can come in for a
// test ride / showroom visit (stored in the siteVisit* fields),
// then raise a service request ticket once both are settled. Also persists
// the lead here (moved from Human_Handoff_Node, which is temporarily
// disabled — see sales.graph.ts) so a confirmed conversion is still saved.
export async function Closing_Node(state: SalesState) {
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];
  const alreadyAgreed = state.purchaseIntentPropertyId !== null;
  const needsVisitDate = alreadyAgreed && !state.siteVisitPreferredDate;

  const closingLlm = llmInstance.withStructuredOutput(
    z.object({
      agreedToProceed: z
        .boolean()
        .describe('True if the customer explicitly reconfirmed they want to go ahead with this bike in this message (a clear "yes" to the confirming question).'),
      siteVisitPreferredDate: z
        .string()
        .nullable()
        .describe('The day/time the customer proposed for a test ride / showroom visit, if this message is answering that question. Null otherwise.'),
      responseToUser: z
        .string()
        .describe('Closing response — follow the phase instructions in the system prompt.'),
    }),
    { name: 'closing_extract' }
  );

  const promptText = await Prompts.getPrompt('closing', state.currentLanguage);
  const propContext = focusProp
    ? `\nModel: ${focusProp.name}. ${focusProp.description ?? ''}`
    : '';
  const phaseContext = needsVisitDate
    ? `\n\nCurrent phase: the customer already agreed to proceed. If this message states a day/time for a test ride / showroom visit, acknowledge it and let them know their request is being raised for that visit. If it does not yet answer that, ask when they'd like to come in for a test ride in the coming days — do NOT mention the request until a visit day/time has been given.`
    : alreadyAgreed
      ? `\n\nCurrent phase: the customer already agreed to proceed and a test ride / showroom visit time has been settled (${state.siteVisitPreferredDate}). Let them know their request is being raised for that visit.`
      : `\n\nCurrent phase: ask the confirming question about going ahead with this bike and price.`;

  const messages = [
    new SystemMessage(promptText + propContext + phaseContext + Prompts.identityContext(state)),
    ...state.messages,
  ];

  const result = await closingLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Closing_Node',
  };

  if (!alreadyAgreed && result.agreedToProceed && focusProp) {
    updates.purchaseIntentPropertyId = focusProp.id;
  }

  // Capture the visit date whenever the LLM extracts one — including a
  // customer who volunteers it in the same breath as their initial "yes"
  // (agreedToProceed) — not only once we've explicitly asked for it.
  if (result.siteVisitPreferredDate && !state.siteVisitPreferredDate) {
    updates.siteVisitPreferredDate = result.siteVisitPreferredDate;
  }

  // Raise the ticket once purchase intent is set AND a site-visit date is
  // known (either just captured above, or already known from Discovery_Node).
  const readyToRaiseTicket =
    (updates.purchaseIntentPropertyId ?? state.purchaseIntentPropertyId) &&
    (updates.siteVisitPreferredDate ?? state.siteVisitPreferredDate) &&
    !state.serviceRequestRaised;

  if (readyToRaiseTicket && focusProp) {
    const ticket = await raiseServiceRequestTicket({
      customerName: state.customerName,
      customerPhone: state.customerPhNo ?? '',
      propertyId: focusProp.id,
      siteVisitPreferredDate: updates.siteVisitPreferredDate ?? state.siteVisitPreferredDate,
    });
    if (ticket.confirmed) {
      updates.serviceRequestRaised = true;
    }

    if (!state.leadSaved) {
      await saveLeadToCrm({
        customerName: state.customerName,
        customerPhone: state.customerPhNo ?? '',
        customerId: state.customerId ?? '',
        agentId: state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '',
        customerAddress: state.customerAddress,
        budgetMin: state.budgetMin,
        budgetMax: state.budgetMax,
        preferredLocation: state.preferredLocation,
        preferredType: state.preferredType,
        moveInTimeline: state.moveInTimeline,
        siteVisitInterested: state.siteVisitInterested,
        siteVisitPreferredDate: updates.siteVisitPreferredDate ?? state.siteVisitPreferredDate,
        interestedPropertyId: updates.purchaseIntentPropertyId ?? state.purchaseIntentPropertyId,
        referralName: state.referralName,
        referralPhone: state.referralPhone,
        sessionId: state.sessionId ?? '',
      });
      updates.leadSaved = true;
    }
  }

  return updates;
}
