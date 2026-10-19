import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { saveLeadToCrm } from '../tool/sales.tools';

// Human Handoff — save lead, acknowledge, then chain into referral
export async function Human_Handoff_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('human_handoff', state.currentLanguage);

  const selectedProp = state.purchaseIntentPropertyId
    ? state.properties.find(p => p.id === state.purchaseIntentPropertyId)
    : state.properties[state.currentPropertyIndex ?? 0];

  const context = selectedProp
    ? `\nProperty the customer wants to proceed with: ${selectedProp.name}. ${selectedProp.description ?? ''}`
    : '';

  const messages = [
    new SystemMessage(promptText + context + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);

  // Persist the lead to CRM at the point of confirmed handoff
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
      siteVisitPreferredDate: state.siteVisitPreferredDate,
      interestedPropertyId: state.purchaseIntentPropertyId,
      referralName: state.referralName,
      referralPhone: state.referralPhone,
      sessionId: state.sessionId ?? '',
    });
  }

  return {
    messages: [response],
    currentNode: 'Human_Handoff_Node',
    leadSaved: true,
  };
}
