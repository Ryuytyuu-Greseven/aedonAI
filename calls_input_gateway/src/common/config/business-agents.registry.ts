/**
 * Single source of truth for "business" identifiers and the domain agent
 * server each one is routed to. Anything in the app that needs to know
 * which businesses exist or where their agent lives should import from
 * here instead of hard-coding its own copy.
 */
import { config } from 'dotenv';

config();

export const DEFAULT_BUSINESS = `${process.env.DEFAULT_AGENT}`;

export const BUSINESS_AGENT_URLS: Record<string, string> = {
  hiring: process.env.HIRING_AGENT_URL ?? 'ws://localhost:4001',
  alerting: process.env.ALERTING_AGENT_URL ?? 'ws://localhost:4002',
  'customer support':
    process.env.CUSTOMER_SUPPORT_AGENT_URL ?? 'ws://localhost:4003',
  insurance: process.env.INSURANCE_AGENT_URL ?? 'ws://localhost:4004',
  bank_contact_centre: process.env.BANK_CONTACT_CENTER ?? 'ws://localhost:4010',
  healthcare_agent: process.env.HEALTHCARE_CENTER ?? 'ws://localhost:4011',
  // Personal companion agent (Madhu) — the lobster_agent repo; keyed by its
  // agent_studio template id like the sales agents below.
  lobster_agent: process.env.LOBSTER_AGENT_URL ?? 'ws://localhost:4005',
  // The three sales agents — keyed by their agent_studio template id, which
  // is what the UI sends as `business` (agent.base_template_id).
  real_estate_sales: process.env.SALES_AGENT_URL ?? 'ws://localhost:4006',
  motor_cycles_sales:
    process.env.MOTOR_CYCLES_AGENT_URL ?? 'ws://localhost:4013',
  home_appliances_sales:
    process.env.HOME_APPLIANCES_AGENT_URL ?? 'ws://localhost:4014',
  'credit cards': process.env.CREDITCARDS_AGENT_URL ?? 'ws://localhost:4007',
  'ecom-customer-service':
    process.env.ECOM_CUTOMER_SERVICE ?? 'ws://localhost:4011',
};

/**
 * When set, EVERY call goes to this business's agent, whatever business the
 * call came in with — so any existing agent can be used to talk to Madhu
 * without creating a lobster_agent one. Defaults to lobster_agent; set
 * FORCE_AGENT_BUSINESS= (empty) to route per business again.
 */
export const FORCED_BUSINESS = normalizeBusiness(
  process.env.FORCE_AGENT_BUSINESS ?? 'lobster_agent',
);

export function normalizeBusiness(business?: string | null): string {
  return (business ?? '').trim().toLowerCase();
}

export function isKnownBusiness(business?: string | null): boolean {
  return normalizeBusiness(business) in BUSINESS_AGENT_URLS;
}

/**
 * Resolves a business name to its agent WebSocket base URL, falling back to
 * DEFAULT_BUSINESS. `forced` (FORCED_BUSINESS by default) overrides both.
 */
export function getAgentUrl(
  business?: string | null,
  forced: string = FORCED_BUSINESS,
): string {
  if (forced && forced in BUSINESS_AGENT_URLS) {
    return BUSINESS_AGENT_URLS[forced];
  }
  const normalized = normalizeBusiness(business);
  console.log('nomalised:', normalized, BUSINESS_AGENT_URLS[normalized] );
  return BUSINESS_AGENT_URLS[normalized] ?? BUSINESS_AGENT_URLS[DEFAULT_BUSINESS]
}

/** True when a call for `business` ends up at the lobster_agent server. */
export function routesToLobster(business?: string | null): boolean {
  return getAgentUrl(business) === BUSINESS_AGENT_URLS.lobster_agent;
}
