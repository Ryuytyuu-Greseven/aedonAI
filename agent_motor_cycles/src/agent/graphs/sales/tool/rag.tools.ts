import { getRagContext } from './knowledge-base.store.js';
import { AgentDetails } from '../state/sales.state.js';

function agentScope(agent: AgentDetails | null | undefined) {
  return {
    knowledgeBaseIds: agent?.knowledge_base_ids ?? [],
    companyId: agent?.companyId ?? null,
  };
}

/** Specs/features deep-dive (Specs_Features_Node) for the motorcycle model currently being discussed. */
export async function retrieveSpecsFeaturesContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(`${propertyName} specifications and features — engine, power, mileage, brakes, comfort. ${userQuery}`, {
    ...agentScope(agent),
    topK: 5,
  });
}

/** Showroom locations, service centres and servicing (Dealer_Service_Node) for the model currently being discussed. */
export async function retrieveDealerServiceContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(
    `Showroom and service centre locations, service schedule and service cost for ${propertyName}. ${userQuery}`,
    { ...agentScope(agent), topK: 5 },
  );
}

/** General factual questions not tied to a specific model (finance/EMI, exchange, insurance, RTO, warranty, etc.). */
export async function retrieveFaqContext(
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(userQuery, { ...agentScope(agent), topK: 5 });
}

/** General model Q&A fallback inside Model_Presentation_Node (variants, colours, price, availability, etc.). */
export async function retrievePresentationContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(`${propertyName}. ${userQuery}`, { ...agentScope(agent), topK: 3 });
}
