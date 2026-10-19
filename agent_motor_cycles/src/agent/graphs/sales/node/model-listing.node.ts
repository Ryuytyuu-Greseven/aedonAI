import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { formatPrice } from '../tool/sales.tools';
import { findPropertiesByAgentId } from '../tool/sales-property.repository';

// Model Listing — fetches every motorcycle model linked to this agent
// (stored in sales_properties, src/schema/sales-properties.schema.ts: just a
// name + free-text description, e.g. "155cc, ABS ... starting from 1.4
// lakhs") and hands the whole list to the LLM. There's no structured
// price/engine/segment to filter on in code, so budget/preference matching is
// entirely the LLM's judgment call — e.g. a "starting from 1.4L" model can
// still fit a 1.6L budget since most models have several variants.
export async function Model_Listing_Node(state: SalesState) {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  const companyId = state.agentDetails?.companyId ?? null;
  const properties = await findPropertiesByAgentId(agentId, companyId);

  if (properties.length === 0) {
    const response = await llmInstance.invoke([
      new SystemMessage(
        `You are a motorcycle sales voice agent. There are currently no motorcycle models configured for this agent. ` +
        `Politely let the customer know someone from the showroom team will follow up with options shortly. Keep it to 2 sentences.` +
        Prompts.buildGlobalGuardrails(state.currentLanguage) +
        Prompts.identityContext(state),
      ),
      ...state.messages,
    ]);
    return { messages: [response], properties: [], currentNode: 'Model_Listing_Node' };
  }

  const promptText = await Prompts.getPrompt('model_listing', state.currentLanguage);
  const propertyList = properties
    .map((p, i) => `Model ${i + 1}: ${p.name}. ${p.description ?? 'No further details on file.'}`)
    .join('\n');

  const customerContext = [
    (state.budgetMin !== null || state.budgetMax !== null) &&
      `Budget: ${state.budgetMin !== null ? formatPrice(state.budgetMin) : 'no minimum stated'} to ${state.budgetMax !== null ? formatPrice(state.budgetMax) : 'no maximum stated'}`,
    state.preferredLocation && `City/area: ${state.preferredLocation}`,
    state.preferredType && `Bike type: ${state.preferredType}`,
  ].filter(Boolean).join(' | ');

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nAll motorcycle models linked to this agent:\n${propertyList}` +
      (customerContext ? `\n\nWhat we know about the customer so far: ${customerContext}` : '') +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const response = await llmInstance.invoke(messages);
  return {
    messages: [response],
    properties,
    currentPropertyIndex: 0,
    currentNode: 'Model_Listing_Node',
  };
}
