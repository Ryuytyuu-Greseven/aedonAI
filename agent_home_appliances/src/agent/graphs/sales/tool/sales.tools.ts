import { upsertAgentLead } from './agent-lead.store.js';

export function formatPrice(price: number): string {
  if (price >= 10_000_000) {
    return `${parseFloat((price / 10_000_000).toFixed(2))} crore`;
  }
  if (price >= 100_000) {
    // Two decimals, not Math.round — prices like 1.45 lakhs would
    // otherwise collapse to "1 lakhs".
    const lakhs = parseFloat((price / 100_000).toFixed(2));
    return `${lakhs} ${lakhs === 1 ? 'lakh' : 'lakhs'}`;
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

// Deliberately generic — no rates, prices, or durations, since these are
// spoken to customers and vary by brand, dealer, and city. Dealer-specific
// facts belong in the Pinecone knowledge base, which takes priority over
// this fallback.
const FAQ_ITEMS: FaqItem[] = [
  {
    keywords: ['loan', 'emi', 'no cost', 'no-cost', 'finance', 'financing', 'credit card', 'bank'],
    answer:
      'EMI options are available through our banking and finance partners, so you can spread the cost over a ' +
      'tenure that suits you. The exact EMI, tenure and any no-cost EMI offers depend on the product, the bank and ' +
      'your card or profile, so the store team will work out an exact quote for you.',
  },
  {
    keywords: ['exchange', 'old fridge', 'old washing machine', 'old tv', 'old ac', 'old one', 'trade in', 'trade-in', 'buyback'],
    answer:
      'You can exchange your old appliance when you buy a new one. Its value depends on the type, age and ' +
      'condition, so the team checks it and then confirms the exact exchange price for you.',
  },
  {
    keywords: ['warranty', 'guarantee', 'extended warranty'],
    answer:
      'Every new product comes with the manufacturer\'s warranty, and extended warranty plans may also be ' +
      'available. Coverage varies by product and part, so the store team can confirm the exact details.',
  },
  {
    keywords: ['install', 'installation', 'demo', 'set up', 'setup', 'wall mount', 'mounting'],
    answer:
      'Our team can arrange delivery and installation, along with a quick demo of how to use it. What is included ' +
      'and any extra charges depend on the product and your location — the store team will confirm the details.',
  },
  {
    keywords: ['delivery', 'deliver', 'in stock', 'stock', 'how soon', 'waiting'],
    answer:
      'Delivery time depends on the product, model and finish you choose and what is in stock near you. ' +
      'The store team can confirm current availability and the expected delivery date.',
  },
  {
    keywords: ['service', 'repair', 'servicing', 'maintenance', 'service centre', 'service center', 'customer care'],
    answer:
      'After-sales service and repairs are handled through authorised service centres. The store team can share ' +
      'how to raise a service request and the service support available in your area.',
  },
  {
    keywords: ['energy', 'star rating', 'electricity', 'power consumption', 'bill', 'inverter'],
    answer:
      'Energy efficiency varies by model, and higher-rated and inverter models generally use less electricity. ' +
      'I can check the exact energy rating for the model you are interested in.',
  },
  {
    keywords: ['return', 'refund', 'replacement', 'cancel'],
    answer:
      'Returns, replacements and cancellations follow the store\'s policy, which can depend on the product. ' +
      'The store team can explain exactly how it works for the item you choose.',
  },
  {
    keywords: ['smartthings', 'app', 'wifi', 'wi-fi', 'alexa', 'google home', 'voice control', 'smart home'],
    answer:
      'Many of our smart products can be connected to the brand\'s app for remote control and monitoring. ' +
      'Compatibility varies by model, so I can confirm whether the one you like supports it.',
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

// The reward is described in words rather than as a fixed amount since it
// differs per dealer — replace with the dealer's actual referral terms.
export function buildReferralPitch(): ReferralCommission {
  const ratePercent = 'a referral reward';
  return {
    ratePercent,
    pitch:
      `Our referral program gives you ${ratePercent} from the store ` +
      `if a friend or family member you refer goes on to buy a product with us. ` +
      `The store team will share the exact reward once their purchase is complete.`,
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
