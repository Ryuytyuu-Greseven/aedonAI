import { getRagContext } from './knowledge-base.store.js';
import { AgentDetails } from '../state/sales.state.js';

function agentScope(agent: AgentDetails | null | undefined) {
  return {
    knowledgeBaseIds: agent?.knowledge_base_ids ?? [],
    companyId: agent?.companyId ?? null,
  };
}

/** Specs/features deep-dive (Specs_Features_Node) for the product currently being discussed. */
export async function retrieveSpecsFeaturesContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(`${propertyName} specifications and features — capacity, size, energy rating, smart and AI features. ${userQuery}`, {
    ...agentScope(agent),
    topK: 5,
  });
}

/** Store locations, delivery, installation and after-sales service (Delivery_Installation_Node) for the product currently being discussed. */
export async function retrieveDeliveryInstallationContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(
    `Store locations, delivery, installation, demo and service centre support for ${propertyName}. ${userQuery}`,
    { ...agentScope(agent), topK: 5 },
  );
}

/** General factual questions not tied to a specific product (finance/EMI, exchange, warranty, returns, payment, etc.). */
export async function retrieveFaqContext(
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(userQuery, { ...agentScope(agent), topK: 5 });
}

/** General product Q&A fallback inside Product_Presentation_Node (models, sizes, finishes, price, availability, etc.). */
export async function retrievePresentationContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(`${propertyName}. ${userQuery}`, { ...agentScope(agent), topK: 3 });
}
