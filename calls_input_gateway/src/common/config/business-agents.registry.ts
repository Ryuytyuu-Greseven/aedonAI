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
  lovebyt: process.env.LOVEBYT_AGENT_URL ?? 'ws://localhost:4005',
  real_estate_sales: process.env.SALES_AGENT_URL ?? 'ws://localhost:4006',
  'credit cards': process.env.CREDITCARDS_AGENT_URL ?? 'ws://localhost:4007',
  'ecom-customer-service':
    process.env.ECOM_CUTOMER_SERVICE ?? 'ws://localhost:4011',
};

export function normalizeBusiness(business?: string | null): string {
  return (business ?? '').trim().toLowerCase();
}

export function isKnownBusiness(business?: string | null): boolean {
  return normalizeBusiness(business) in BUSINESS_AGENT_URLS;
}

/** Resolves a business name to its agent WebSocket base URL, falling back to DEFAULT_BUSINESS. */
export function getAgentUrl(business?: string | null): string {
  const normalized = normalizeBusiness(business);
  console.log('nomalised:', normalized, BUSINESS_AGENT_URLS[normalized] );
  return BUSINESS_AGENT_URLS[normalized] ?? BUSINESS_AGENT_URLS[DEFAULT_BUSINESS]
}
