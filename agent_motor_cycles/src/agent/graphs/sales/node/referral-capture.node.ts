import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { buildReferralPitch, saveLeadToCrm } from '../tool/sales.tools';

// Referral Capture — pitch program, capture referee details
export async function Referral_Capture_Node(state: SalesState) {
  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      referralName: z.string().nullable().describe("First name of the person being referred. Null if not provided."),
      referralPhone: z.string().nullable().describe("Phone number of the person being referred. Null if not provided."),
      referralAccepted: z.boolean().describe("True if the customer said yes to referring someone or provided referral details."),
      responseToUser: z.string().describe("Warm, natural response about the referral program, describing the reward exactly as given in context."),
    }),
    { name: 'extract_referral' }
  );

  const promptText = await Prompts.getPrompt('referral', state.currentLanguage);
  const commissionContext = `\n\n${buildReferralPitch().pitch}`;

  // The first pitch happens via a hardcoded edge from Human_Handoff_Node in
  // the same turn; currentNode is only ever already 'Referral_Capture_Node'
  // on a follow-up turn, once the customer is replying to that pitch.
  const alreadyPitched = state.currentNode === 'Referral_Capture_Node';
  const phaseContext = alreadyPitched
    ? '\n\nThe referral pitch has already been given this call — this is a follow-up. Do not repeat the full pitch; follow the PHASE 2 rules (capture details or acknowledge their decision).'
    : '\n\nThis is the first time the referral program is being pitched this call — follow the PHASE 1 rules.';

  const messages = [
    new SystemMessage(promptText + commissionContext + phaseContext + Prompts.identityContext(state)),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    currentNode: 'Referral_Capture_Node',
  };

  if (result.referralAccepted) updates.referralCaptured = true;
  if (result.referralName) updates.referralName = result.referralName;
  if (result.referralPhone) updates.referralPhone = result.referralPhone;

  // If we captured referral details, update the CRM record
  if ((result.referralName || result.referralPhone) && state.leadSaved) {
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
      referralName: result.referralName,
      referralPhone: result.referralPhone,
      sessionId: state.sessionId ?? '',
    });
  }

  return updates;
}
