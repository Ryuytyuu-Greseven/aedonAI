import { upsertAgentLead } from './agent-lead.store.js';

export function formatPrice(price: number): string {
  if (price >= 10_000_000) {
    return `${parseFloat((price / 10_000_000).toFixed(2))} crore`;
  }
  if (price >= 100_000) {
    // Two decimals, not Math.round — bike prices like 1.45 lakhs would
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
    keywords: ['loan', 'emi', 'finance', 'financing', 'down payment', 'downpayment', 'bank'],
    answer:
      'Easy finance options are available through our banking and finance partners — you pay a down payment ' +
      'and the rest in monthly EMIs over a tenure that suits you. The exact interest rate, EMI and down payment ' +
      'depend on the model, the lender and your profile, so the showroom team will work out an exact quote for you.',
  },
  {
    keywords: ['exchange', 'old bike', 'trade in', 'trade-in', 'my current bike', 'sell my bike'],
    answer:
      'You can exchange your current two-wheeler at the showroom. Its value depends on the model, age, condition ' +
      'and kilometres run, so the team does a quick inspection and then gives you an exact exchange price.',
  },
  {
    keywords: ['on-road', 'on road', 'rto', 'registration', 'road tax', 'number plate'],
    answer:
      'The on-road price is the ex-showroom price plus RTO registration, road tax and insurance, and these charges ' +
      'vary by state and city. The showroom handles the registration paperwork for you and can share the exact ' +
      'on-road price for your city.',
  },
  {
    keywords: ['insurance', 'insure', 'zero dep', 'zero depreciation'],
    answer:
      'Insurance is mandatory and is arranged at the time of purchase as part of the on-road price. You can choose ' +
      'the cover and add-ons like zero depreciation — the showroom team can walk you through the options and premiums.',
  },
  {
    keywords: ['warranty', 'guarantee', 'extended warranty'],
    answer:
      'Every new bike comes with the manufacturer\'s warranty, and extended warranty plans may also be available. ' +
      'Exact coverage varies by model, so the showroom team can confirm the details for the bike you choose.',
  },
  {
    keywords: ['service', 'servicing', 'free service', 'maintenance', 'service centre', 'service center'],
    answer:
      'New bikes come with a set of free services in the initial period, and servicing is done at authorised ' +
      'service centres. The exact schedule and costs depend on the model — I can have the team share them with you.',
  },
  {
    keywords: ['document', 'documents', 'paperwork', 'kyc', 'id proof', 'address proof'],
    answer:
      'To buy a bike you will usually need an ID proof, an address proof and a photograph. If you are taking ' +
      'finance, the lender may also ask for income proof and bank statements.',
  },
  {
    keywords: ['delivery', 'waiting period', 'waiting time', 'in stock', 'stock', 'how soon'],
    answer:
      'Delivery time depends on the model, variant and colour you choose and what is in stock at your nearest ' +
      'showroom. The showroom team can confirm current availability and the expected delivery date.',
  },
  {
    keywords: ['test ride', 'test drive', 'try the bike'],
    answer:
      'You can take a test ride at the showroom — just tell me a day and time that suits you and I will have it arranged.',
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
      `Our referral program gives you ${ratePercent} from the showroom ` +
      `if a friend or family member you refer goes on to buy a motorcycle with us. ` +
      `The showroom team will share the exact reward once their purchase is complete.`,
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
