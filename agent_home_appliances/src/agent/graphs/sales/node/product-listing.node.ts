import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { formatPrice } from '../tool/sales.tools';
import { findPropertiesByAgentId } from '../tool/sales-property.repository';

// Product Listing — fetches every product / product line linked to this
// agent (stored in sales_properties, src/schema/sales-properties.schema.ts:
// just a name + free-text description, e.g. "French door refrigerator,
// 650L ... starting from 85 thousand") and hands the whole list to the LLM.
// There's no structured price/category/capacity to filter on in code, so
// category and budget matching is entirely the LLM's judgment call.
export async function Product_Listing_Node(state: SalesState) {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  const companyId = state.agentDetails?.companyId ?? null;
  const properties = await findPropertiesByAgentId(agentId, companyId);

  if (properties.length === 0) {
    const response = await llmInstance.invoke([
      new SystemMessage(
        `You are a home appliances and electronics sales voice agent. There are currently no products configured for this agent. ` +
        `Politely let the customer know someone from the store team will follow up with options shortly. Keep it to 2 sentences.` +
        Prompts.buildGlobalGuardrails(state.currentLanguage) +
        Prompts.identityContext(state),
      ),
      ...state.messages,
    ]);
    return { messages: [response], properties: [], currentNode: 'Product_Listing_Node' };
  }

  const promptText = await Prompts.getPrompt('product_listing', state.currentLanguage);
  const propertyList = properties
    .map((p, i) => `Product ${i + 1}: ${p.name}. ${p.description ?? 'No further details on file.'}`)
    .join('\n');

  const customerContext = [
    (state.budgetMin !== null || state.budgetMax !== null) &&
      `Budget: ${state.budgetMin !== null ? formatPrice(state.budgetMin) : 'no minimum stated'} to ${state.budgetMax !== null ? formatPrice(state.budgetMax) : 'no maximum stated'}`,
    state.preferredLocation && `City/area: ${state.preferredLocation}`,
    state.preferredType && `Looking for: ${state.preferredType}`,
  ].filter(Boolean).join(' | ');

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nAll products linked to this agent:\n${propertyList}` +
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
    currentNode: 'Product_Listing_Node',
  };
}
