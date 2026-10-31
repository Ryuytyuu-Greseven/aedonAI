import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { formatPrice } from '../tool/sales.tools';
import { findPropertiesByAgentId, SalesPropertyRecord } from '../tool/sales-property.repository';
import * as fs from 'fs/promises';
import * as path from 'path';

// Model Listing — fetches every motorcycle model linked to this agent
// (stored in sales_properties, or falling back to the rich sample catalog in properties.json).
export async function Model_Listing_Node(state: SalesState) {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  const companyId = state.agentDetails?.companyId ?? null;
  let properties: SalesPropertyRecord[] = await findPropertiesByAgentId(agentId, companyId);

  if (properties.length === 0) {
    try {
      const fallbackPath = path.join(process.cwd(), 'src', 'config', 'properties.json');
      const raw = await fs.readFile(fallbackPath, 'utf-8');
      const catalog = JSON.parse(raw);
      properties = catalog.map((c: any) => ({
        id: c.id,
        companyId: null,
        agentId,
        name: c.name,
        description: `${c.shortPitch} Starting ex-showroom ₹${c.price.toLocaleString('en-IN')} (approx on-road ₹${(c.onRoadPrice ?? c.price * 1.15).toLocaleString('en-IN')}). Fuel economy: ${c.mileageKmpl} km/l. Highlights: ${c.highlights?.join(', ')}. EMI: ${c.sampleEmi ?? 'Low down payment schemes available'}.`,
      }));
    } catch (e) {
      // Ignore if fallback file cannot be read
    }
  }

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
    .map((p: SalesPropertyRecord, i: number) => `Model ${i + 1}: ${p.name}. ${p.description ?? 'No further details on file.'}`)
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
