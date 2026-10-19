import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { saveLeadToCrm } from '../tool/sales.tools';

// Graceful Rejection — call is ending without a confirmed purchase. Whatever
// qualifying details were captured along the way (name, address, budget,
// timeline, site-visit interest, etc.) are still a lead worth keeping.
export async function Graceful_Rejection_Node(state: SalesState) {
  const promptText = await Prompts.getPrompt('graceful_rejection', state.currentLanguage);
  const nameContext = state.customerName ? `\nCustomer name: ${state.customerName}` : '';

  const messages = [
    new SystemMessage(promptText + nameContext + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);

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

  return { messages: [response], currentNode: 'Graceful_Rejection_Node', leadSaved: true };
}
