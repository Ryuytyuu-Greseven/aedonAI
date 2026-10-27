import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { raiseServiceRequestTicket, saveLeadToCrm } from '../tool/sales.tools';
import { recordProductEnquiry } from '../tool/product-enquiry.store';

// Closing — schedules on-site visit (sample flat inspection, amenities walkthrough),
// settles preferred day, time slot, and cab logistics, then generates a service
// ticket and saves the enriched lead to CRM for relationship manager handoff.
export async function Closing_Node(state: SalesState) {
  const focusProp = state.properties[state.currentPropertyIndex ?? 0];
  const visitDateKnown = Boolean(state.siteVisitPreferredDate);
  const timeSlotKnown = Boolean(state.siteVisitTimeSlot);

  const closingLlm = llmInstance.withStructuredOutput(
    z.object({
      agreedToVisitOrProceed: z
        .boolean()
        .describe('True if the customer expressed interest in visiting the site, or agreed to proceed with scheduling a visit.'),
      siteVisitPreferredDate: z
        .string()
        .nullable()
        .describe('Day or date proposed for the site visit (e.g. "Saturday", "Sunday", "tomorrow"). Null if not stated.'),
      siteVisitTimeSlot: z
        .string()
        .nullable()
        .describe('Time window for visit (e.g. "morning", "afternoon", "11 AM"). Null if not stated.'),
      cabRequired: z
        .boolean()
        .nullable()
        .describe('True/false if customer requested or agreed to complimentary doorstep cab pickup. Null if not mentioned.'),
      customerName: z
        .string()
        .nullable()
        .describe("Customer's name if mentioned or volunteered for the visitor pass. Null otherwise."),
      customerAddress: z
        .string()
        .nullable()
        .describe("Customer's pickup address/locality if mentioned for cab arrangement. Null otherwise."),
      responseToUser: z
        .string()
        .describe('Closing response — follow the site visit scheduling phases in the prompt.'),
    }),
    { name: 'closing_extract' }
  );

  const promptText = await Prompts.getPrompt('closing', state.currentLanguage);
  const propContext = focusProp
    ? `\nProperty: ${focusProp.name}. ${focusProp.description ?? ''}`
    : '';

  const phaseContext =
    visitDateKnown && timeSlotKnown
      ? `\n\nCurrent phase: The customer has selected both visit day (${state.siteVisitPreferredDate}) and time slot (${state.siteVisitTimeSlot}). Confirm their reservation warmly and let them know the relationship manager is assigning their digital visitor pass and location pin on WhatsApp.`
      : visitDateKnown
        ? `\n\nCurrent phase: The customer chose ${state.siteVisitPreferredDate}. Ask whether morning or afternoon works best, and mention complimentary cab pickup if needed.`
        : `\n\nCurrent phase: Propose the two convenient weekend viewing slots (Saturday morning or Sunday afternoon) to view the sample flat and project amenities.`;

  const messages = [
    new SystemMessage(promptText + propContext + phaseContext + Prompts.identityContext(state)),
    ...state.messages,
  ];

  const result = await closingLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Closing_Node',
  };

  if (focusProp && (result.agreedToVisitOrProceed || result.siteVisitPreferredDate)) {
    updates.siteVisitInterested = true;
    void recordProductEnquiry(state, focusProp, 'purchase_intent');
  }

  if (result.siteVisitPreferredDate && !state.siteVisitPreferredDate) {
    updates.siteVisitPreferredDate = result.siteVisitPreferredDate;
  }

  if (result.siteVisitTimeSlot && !state.siteVisitTimeSlot) {
    updates.siteVisitTimeSlot = result.siteVisitTimeSlot;
  }

  if (result.cabRequired !== null) {
    updates.cabRequired = result.cabRequired;
  }

  if (result.customerName && !state.customerName) {
    updates.customerName = result.customerName;
  }

  if (result.customerAddress && !state.customerAddress) {
    updates.customerAddress = result.customerAddress;
  }

  const visitDate = updates.siteVisitPreferredDate ?? state.siteVisitPreferredDate;
  const visitSlot = updates.siteVisitTimeSlot ?? state.siteVisitTimeSlot;
  const cabReq = updates.cabRequired ?? state.cabRequired;

  // Raise the ticket once a visit date or slot is settled and hasn't been raised yet
  const readyToRaiseTicket = visitDate && !state.serviceRequestRaised && focusProp;

  if (readyToRaiseTicket) {
    const ticket = await raiseServiceRequestTicket({
      customerName: updates.customerName ?? state.customerName,
      customerPhone: state.customerPhNo ?? '',
      propertyId: focusProp.id,
      siteVisitPreferredDate: visitDate,
      siteVisitTimeSlot: visitSlot,
      cabRequired: cabReq,
    });

    if (ticket.confirmed) {
      updates.serviceRequestRaised = true;
      void recordProductEnquiry(state, focusProp, 'site_visit');
    }

    if (!state.leadSaved) {
      await saveLeadToCrm({
        customerName: updates.customerName ?? state.customerName,
        customerPhone: state.customerPhNo ?? '',
        customerId: state.customerId ?? '',
        agentId: state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '',
        customerAddress: updates.customerAddress ?? state.customerAddress,
        budgetMin: state.budgetMin,
        budgetMax: state.budgetMax,
        preferredLocation: state.preferredLocation,
        preferredType: state.preferredType,
        moveInTimeline: state.moveInTimeline,
        buyerType: state.buyerType,
        siteVisitInterested: true,
        siteVisitPreferredDate: visitDate,
        siteVisitTimeSlot: visitSlot,
        cabRequired: cabReq,
        interestedPropertyId: focusProp.id,
        referralName: state.referralName,
        referralPhone: state.referralPhone,
        sessionId: state.sessionId ?? '',
      });
      updates.leadSaved = true;
    }
  }

  return updates;
}
