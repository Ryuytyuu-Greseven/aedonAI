import { upsertAgentLead } from './agent-lead.store.js';

export function formatPrice(price: number): string {
  if (price >= 10_000_000) {
    return `${parseFloat((price / 10_000_000).toFixed(2))} crore`;
  }
  if (price >= 100_000) {
    return `${Math.round(price / 100_000)} lakhs`;
  }
  return `₹${price.toLocaleString('en-IN')}`;
}

// ---------------------------------------------------------------------------
// FAQ — keyword-based lookup (swap for vector search when RAG is available)
// ---------------------------------------------------------------------------

interface FaqItem {
  keywords: string[];
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    keywords: ['home loan', 'loan', 'emi', 'bank', 'finance', 'financing', 'mortgage'],
    answer:
      'Home loans are available through all major banks at rates starting from 8.5% per annum. ' +
      'Our preferred banking partners — HDFC, SBI, and ICICI — offer pre-approved buyers priority ' +
      'processing and sanction within 72 hours. We also have an in-house loan assistance team to help ' +
      'you with documentation.',
  },
  {
    keywords: ['rera', 'registration', 'legal', 'approved', 'government'],
    answer:
      'All our listed projects are RERA registered, which means the builder is legally bound to deliver ' +
      'on time and as specified. You can verify the RERA number on the official state RERA portal at any time.',
  },
  {
    keywords: ['stamp duty', 'stamp', 'duty', 'registration charges', 'registration cost'],
    answer:
      'Stamp duty in Karnataka is typically 5% of the property value, plus 1% registration charges. ' +
      'Some of our current projects have a zero stamp duty offer — I can confirm which ones apply for you.',
  },
  {
    keywords: ['possession', 'ready', 'move in', 'handover', 'delivery', 'completion'],
    answer:
      'Possession timelines vary by project. Some of our listings are ready to move in immediately, ' +
      'while others have a 6 to 12 month delivery schedule. I can share the exact possession date for ' +
      'whichever property you are interested in.',
  },
  {
    keywords: ['maintenance', 'society', 'monthly charges', 'hoa', 'association'],
    answer:
      'Monthly maintenance charges typically range from ₹2 to ₹5 per square foot depending on the ' +
      'project amenities. This covers security, housekeeping of common areas, and facility management.',
  },
  {
    keywords: ['parking', 'car park', 'vehicle', 'garage'],
    answer:
      'Most of our projects include at least one covered car parking space with the apartment. ' +
      'Villas typically include a two-car garage. Additional parking can be purchased separately where available.',
  },
  {
    keywords: ['vastu', 'direction', 'east facing', 'north facing', 'feng shui'],
    answer:
      'Several of our projects are Vastu-compliant with east and north-facing units available. ' +
      'I can check the specific unit orientation for you and confirm whether it meets your Vastu preference.',
  },
  {
    keywords: ['school', 'hospital', 'mall', 'metro', 'connectivity', 'nearby', 'around'],
    answer:
      'Each of our projects is located near key social infrastructure. I can walk you through the ' +
      'specific landmarks, schools, hospitals, and connectivity options for any property you have in mind.',
  },
  {
    keywords: ['investment', 'rental', 'yield', 'return', 'appreciation', 'roi'],
    answer:
      'Bangalore real estate has seen consistent 8 to 12 percent annual appreciation in prime corridors. ' +
      'Rental yields range from 3 to 5.5 percent depending on location and property type. ' +
      'Studio and compact apartments in Koramangala and Whitefield tend to offer the highest rental returns.',
  },
  {
    keywords: ['gst', 'tax', 'tds', 'income tax'],
    answer:
      'GST of 5% applies on under-construction properties. Ready-to-move-in apartments are exempt from GST. ' +
      'TDS of 1% applies on properties valued above 50 lakhs. Our team can connect you with a tax advisor for details.',
  },
];

export function lookupFaq(query: string): string | null {
  const lower = query.toLowerCase();
  for (const item of FAQ_ITEMS) {
    if (item.keywords.some(k => lower.includes(k))) {
      return item.answer;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Referral commission calculator
// ---------------------------------------------------------------------------

export interface ReferralCommission {
  ratePercent: string;
  pitch: string;
}

// Property prices now live as free text inside SalesProperty.description
// rather than a structured numeric field, so this no longer computes a
// concrete rupee estimate — the LLM can quote a specific figure itself from
// conversation context if it already knows the property's price.
export function buildReferralPitch(): ReferralCommission {
  const ratePercent = '1%';
  return {
    ratePercent,
    pitch:
      `Our referral program rewards you with ${ratePercent} of the property's purchase value ` +
      `if a friend or family member you refer goes on to purchase a property with us. ` +
      `The reward is paid directly to you after their registration is complete.`,
  };
}

// ---------------------------------------------------------------------------
// CRM — save lead (replace with real CRM/webhook call in production)
// ---------------------------------------------------------------------------

export interface LeadPayload {
  customerName: string | null;
  customerPhone: string;
  customerId: string;
  agentId: string;
  customerAddress: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
  preferredType: string | null;
  moveInTimeline: string | null;
  siteVisitInterested: boolean | null;
  siteVisitPreferredDate: string | null;
  interestedPropertyId: string | null;
  referralName: string | null;
  referralPhone: string | null;
  sessionId: string;
}

// Persists the lead to the `agent_leads` collection (see
// src/schema/agent-lead.schema.ts). One session = one lead document,
// upserted as more qualifying details are captured through the call.
export async function saveLeadToCrm(lead: LeadPayload): Promise<boolean> {
  const leadId = lead.sessionId || `${lead.customerId}:${lead.agentId}`;
  try {
    await upsertAgentLead({
      leadId,
      customerId: lead.customerId,
      agentId: lead.agentId,
      source: 'call',
      fullName: lead.customerName,
      phoneNumber: lead.customerPhone,
      address: lead.customerAddress,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      preferredLocation: lead.preferredLocation,
      preferredType: lead.preferredType,
      purchaseTimeline: lead.moveInTimeline,
      siteVisitInterested: lead.siteVisitInterested,
      siteVisitPreferredDate: lead.siteVisitPreferredDate,
      interestedPropertyId: lead.interestedPropertyId,
      referralName: lead.referralName,
      referralPhone: lead.referralPhone,
      sessionId: lead.sessionId,
    });
    console.log('[CRM] Lead upserted into agent_leads:', leadId);
    return true;
  } catch (error) {
    // Non-fatal — a CRM persistence hiccup shouldn't drop the live call.
    console.error('[CRM] Failed to upsert lead:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Service request ticket (replace with real CRM/ticketing API in production)
// ---------------------------------------------------------------------------

export interface ServiceRequestResult {
  confirmed: boolean;
  ticketId: string;
  message: string;
}

export async function raiseServiceRequestTicket(params: {
  customerName: string | null;
  customerPhone: string;
  propertyId: string;
  siteVisitPreferredDate?: string | null;
}): Promise<ServiceRequestResult> {
  // TODO: Replace with real CRM/ticketing API
  const ticketId = `SR-${Date.now().toString(36).toUpperCase()}`;
  console.log('[ServiceRequest] Ticket raised:', JSON.stringify(params));
  return {
    confirmed: true,
    ticketId,
    message:
      `Your service request has been raised. Your reference number is ${ticketId}. ` +
      `One of our human agents will call you shortly to help you with the next steps.`,
  };
}
