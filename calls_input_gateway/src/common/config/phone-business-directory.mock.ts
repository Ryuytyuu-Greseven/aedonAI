/**
 * TEMPORARY mock of the "which business owns this phone number" mapping.
 *
 * Each business (see business-agents.registry.ts) has its own inbound
 * number(s) on Twilio/Exotel. Right now that assignment lives here as a
 * static table; it will be replaced by a MongoDB-backed lookup (numbers
 * assigned per business/tenant) without changing BusinessDirectoryService's
 * public API — only this file's contents move into the database.
 *
 * Keys are E.164-normalized numbers (leading "+", digits only after that).
 */
export const MOCK_PHONE_BUSINESS_MAP: Record<string, string> = {
  '+14155550101': 'hiring',
  '+14155550102': 'alerting',
  '+14155550103': 'customer support',
  '+14155550104': 'insurance',
  '+14155550105': 'lovebyt',
  '+14155550106': 'sales',
  '+14155550107': 'credit cards',
  '+14155550108': 'ecom-customer-service',
};
