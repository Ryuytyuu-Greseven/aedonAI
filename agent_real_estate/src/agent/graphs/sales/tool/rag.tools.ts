import { getRagContext } from './knowledge-base.store.js';
import { AgentDetails } from '../state/sales.state.js';

function agentScope(agent: AgentDetails | null | undefined) {
  return {
    knowledgeBaseIds: agent?.knowledge_base_ids ?? [],
    companyId: agent?.companyId ?? null,
  };
}

/** Amenities/features deep-dive for the property currently being discussed. */
export async function retrieveAmenitiesContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(`${propertyName} amenities and features. ${userQuery}`, {
    ...agentScope(agent),
    topK: 5,
  });
}

/** Nearby schools/hospitals/malls/connectivity for the property currently being discussed. */
export async function retrieveNearbyFacilitiesContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(
    `Schools, hospitals, malls, restaurants and connectivity near ${propertyName}. ${userQuery}`,
    { ...agentScope(agent), topK: 5 },
  );
}

/** General factual questions not tied to a specific property (loans, RERA, stamp duty, GST, etc.). */
export async function retrieveFaqContext(
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(userQuery, { ...agentScope(agent), topK: 5 });
}

/** General property Q&A fallback inside Presentation_Node (location, possession date, loan process, etc.). */
export async function retrievePresentationContext(
  propertyName: string,
  userQuery: string,
  agent: AgentDetails | null | undefined,
): Promise<string | null> {
  return getRagContext(`${propertyName}. ${userQuery}`, { ...agentScope(agent), topK: 3 });
}
