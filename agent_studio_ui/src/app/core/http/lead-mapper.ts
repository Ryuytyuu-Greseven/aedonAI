import { AgentLead, LeadsPage, PageLead } from '../models/lead.model';

/** One entry in a Meta lead's `callAttempts` — one row per time the agent was triggered to call this lead. */
export interface ApiCallAttempt {
  callId: string;
  attemptedAt: string;
}

/** Wire shape of one entry in `GET /api/integrations/meta/leads`'s `leads` array. */
export interface ApiMetaLead {
  id: string;
  customerId: string;
  pageId: string;
  leadgenId: string;
  formId: string;
  adId: string;
  adgroupId: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  customFields: Record<string, string>;
  metaCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  callAttempts?: ApiCallAttempt[];
}

export interface ApiLeadsResponse<T> {
  leads: T[];
  total: number;
  page: number;
  limit: number;
}

export function fromApiMetaLead(raw: ApiMetaLead): PageLead {
  return {
    id: raw.id,
    page_id: raw.pageId,
    full_name: raw.fullName,
    phone_number: raw.phoneNumber,
    email: raw.email,
    custom_fields: raw.customFields ?? {},
    submitted_at: raw.metaCreatedAt,
    call_attempts_count: raw.callAttempts?.length ?? 0,
  };
}

export function fromApiMetaLeadsResponse(raw: ApiLeadsResponse<ApiMetaLead>): LeadsPage<PageLead> {
  return {
    leads: raw.leads.map(fromApiMetaLead),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}

/**
 * Wire shape of one entry in `GET /api/agents/:id/leads`'s `leads` array. Unlike Meta leads, this
 * endpoint returns the raw Mongo document — `_id`, not a normalized `id`.
 */
export interface ApiAgentLead {
  _id: string;
  customerId: string;
  agentId: string;
  leadId: string;
  source: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  customFields: Record<string, string>;
  leadCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Real API has no qualification/intent-summary/follow-up-action/outcome/call linkage —
 * those are set `null` until a future backend change adds them.
 */
export function fromApiAgentLead(raw: ApiAgentLead): AgentLead {
  return {
    id: raw._id,
    agent_id: raw.agentId,
    customer_name: raw.fullName || null,
    phone_number: raw.phoneNumber,
    email: raw.email,
    custom_fields: raw.customFields ?? {},
    source: raw.source,
    created_at: raw.leadCreatedAt,
    call: null,
    intent_summary: null,
    qualification: null,
    follow_up_action: null,
    outcome: null,
  };
}

export function fromApiAgentLeadsResponse(raw: ApiLeadsResponse<ApiAgentLead>): LeadsPage<AgentLead> {
  return {
    leads: raw.leads.map(fromApiAgentLead),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}
