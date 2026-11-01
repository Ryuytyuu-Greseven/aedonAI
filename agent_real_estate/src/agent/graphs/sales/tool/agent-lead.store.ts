import { Model } from 'mongoose';
import { AgentLead, AgentLeadSchema } from '../../../../schema/agent-lead.schema.js';
import { getMongooseConnection } from './mongoose-connection.js';

let modelPromise: Promise<Model<AgentLead>> | null = null;

function getAgentLeadModel(): Promise<Model<AgentLead>> {
  if (!modelPromise) {
    modelPromise = getMongooseConnection().then((connection) =>
      connection.model<AgentLead>(AgentLead.name, AgentLeadSchema, 'agent_leads'),
    );
  }
  return modelPromise;
}

export interface AgentLeadUpsertInput {
  leadId: string;
  customerId: string;
  agentId: string;
  source: string;
  fullName: string | null;
  phoneNumber: string;
  email?: string | null;
  address: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocation: string | null;
  preferredType: string | null;
  purchaseTimeline: string | null;
  buyerType?: string | null;
  siteVisitInterested: boolean | null;
  siteVisitPreferredDate: string | null;
  siteVisitTimeSlot?: string | null;
  cabRequired?: boolean | null;
  interestedPropertyId: string | null;
  referralName: string | null;
  referralPhone: string | null;
  sessionId: string;
  customFields?: Record<string, any>;
}

// One lead document per call session — upserted as more qualifying details
// are captured through the conversation, keyed by the stable `leadId`
// (derived from sessionId by the caller) rather than inserted fresh each time.
export async function upsertAgentLead(lead: AgentLeadUpsertInput): Promise<void> {
  const model = await getAgentLeadModel();
  const { leadId, ...fields } = lead;

  // Only set fields that are actually known this call — avoids clobbering a
  // previously captured value (e.g. address from an earlier turn) with a
  // null from a turn that didn't happen to re-extract it.
  const setFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined),
  );

  await model.findOneAndUpdate(
    { leadId },
    { $set: setFields, $setOnInsert: { leadId, leadCreatedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

/**
 * Searches for a previous lead record by phone number (matching the last 10 digits),
 * scoped to this agentId when available. Returns the most recent record to recognize returning callers.
 */
export async function findRecentLeadByPhone(
  phoneNumber: string,
  agentId?: string,
): Promise<Partial<AgentLead> | null> {
  if (!phoneNumber || phoneNumber.trim().length < 7) return null;

  try {
    const model = await getAgentLeadModel();
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    const last10 = cleanDigits.slice(-10);

    const query: Record<string, any> = {
      phoneNumber: { $regex: new RegExp(`${last10}$`) },
    };
    if (agentId) {
      query.agentId = agentId;
    }

    const doc = await model
      .findOne(query)
      .sort({ updatedAt: -1 })
      .lean<AgentLead>()
      .exec();

    return doc;
  } catch (err: any) {
    console.warn('[CRM] Failed to lookup returning lead by phone:', err?.message || err);
    return null;
  }
}

