import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { formatPrice } from '../tool/sales.tools';
import { findPropertiesByAgentId } from '../tool/sales-property.repository';

// Property Listing — fetches every property linked to this agent
// (src/schema/sales-properties.schema.ts: just a name + free-text
// description, e.g. "2Bhk, 3 Bhk ... starting from 55 lakhs") and hands the
// whole list to the LLM. There's no structured price/type/location to
// filter on in code, so budget/preference matching is entirely the LLM's
// judgment call — e.g. a "starting from 50L" listing can still fit a 60L
// budget since the building likely has many unit types at different prices.
export async function Property_Listing_Node(state: SalesState) {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  const companyId = state.agentDetails?.companyId ?? null;
  const properties = await findPropertiesByAgentId(agentId, companyId);

  if (properties.length === 0) {
    const response = await llmInstance.invoke([
      new SystemMessage(
        `You are a property sales voice agent. There are currently no listings configured for this agent. ` +
        `Politely let the customer know a specialist will follow up with options shortly. Keep it to 2 sentences.` +
        Prompts.buildGlobalGuardrails(state.currentLanguage) +
        Prompts.identityContext(state),
      ),
      ...state.messages,
    ]);
    return { messages: [response], properties: [], currentNode: 'Property_Listing_Node' };
  }

  const promptText = await Prompts.getPrompt('property_listing', state.currentLanguage);
  const propertyList = properties
    .map((p, i) => `Property ${i + 1}: ${p.name}. ${p.description ?? 'No further details on file.'}`)
    .join('\n');

  const customerContext = [
    (state.budgetMin !== null || state.budgetMax !== null) &&
      `Budget: ${formatPrice(state.budgetMin ?? 0)} to ${formatPrice(state.budgetMax ?? 999_999_999)}`,
    state.preferredLocation && `Preferred location: ${state.preferredLocation}`,
    state.preferredType && `Preferred type: ${state.preferredType}`,
  ].filter(Boolean).join(' | ');

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nAll properties linked to this agent:\n${propertyList}` +
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
    currentNode: 'Property_Listing_Node',
  };
}
