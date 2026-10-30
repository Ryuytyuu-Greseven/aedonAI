import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { saveLeadToCrm } from '../tool/sales.tools';

// Human Handoff — save lead, acknowledge, and clarify preferred contact method
export async function Human_Handoff_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      customerName: z
        .string()
        .nullable()
        .describe("Customer's name if mentioned or introduced. Null otherwise."),
      customerPhone: z
        .string()
        .nullable()
        .describe("Customer's phone number if provided for callback or WhatsApp. Null otherwise."),
      customerEmail: z
        .string()
        .nullable()
        .describe("Customer's email address if provided for follow-up. Null otherwise."),
      preferredContactMethod: z
        .string()
        .nullable()
        .describe("Preferred contact method if stated ('phone', 'whatsapp', 'email'). Null otherwise."),
      responseToUser: z
        .string()
        .describe(
          'Spoken response — connect with sales specialist. ' +
          'If preferred contact method (phone call vs WhatsApp) is unknown, ask their preference. ' +
          'If phone number is missing and they request a call, ask for their preferred number. ' +
          'If details are already known, confirm without re-asking: "Certainly! I\'ll have a team member reach out on this number."',
        ),
    }),
    { name: 'human_handoff_extract' }
  );

  const promptText = await Prompts.getPrompt('human_handoff', state.currentLanguage);

  const selectedProp = state.purchaseIntentPropertyId
    ? state.properties.find(p => p.id === state.purchaseIntentPropertyId)
    : state.properties[state.currentPropertyIndex ?? 0];

  const context = selectedProp
    ? `\nProperty the customer wants to proceed with: ${selectedProp.name}. ${selectedProp.description ?? ''}`
    : '';

  const messages = [
    new SystemMessage(
      promptText +
      context +
      Prompts.customerProfileContext(state) +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];
  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Human_Handoff_Node',
    leadSaved: true,
  };

  if (result.customerName && !state.customerName) updates.customerName = result.customerName;
  if (result.customerPhone && !state.customerPhNo) updates.customerPhNo = result.customerPhone;
  if (result.customerEmail && !state.customerEmail) updates.customerEmail = result.customerEmail;
  if (result.preferredContactMethod && !state.preferredContactMethod) updates.preferredContactMethod = result.preferredContactMethod;

  const phoneToUse = updates.customerPhNo ?? state.customerPhNo ?? '';

  // Persist the lead to CRM at the point of confirmed handoff
  if (!state.leadSaved) {
    await saveLeadToCrm({
      customerName: updates.customerName ?? state.customerName,
      customerPhone: phoneToUse,
      customerEmail: updates.customerEmail ?? state.customerEmail,
      preferredContactMethod: updates.preferredContactMethod ?? state.preferredContactMethod,
      customerId: state.customerId ?? '',
      agentId: state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '',
      customerAddress: state.customerAddress,
      budgetMin: state.budgetMin,
      budgetMax: state.budgetMax,
      preferredLocation: state.preferredLocation,
      preferredType: state.preferredType,
      moveInTimeline: state.moveInTimeline,
      buyerType: state.buyerType,
      siteVisitInterested: state.siteVisitInterested,
      siteVisitPreferredDate: state.siteVisitPreferredDate,
      interestedPropertyId: state.purchaseIntentPropertyId,
      referralName: state.referralName,
      referralPhone: state.referralPhone,
      sessionId: state.sessionId ?? '',
    });
  }

  return updates;
}
