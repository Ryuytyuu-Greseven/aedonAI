import { AgentLead, LeadsPage, ManualLead, PageLead, PageLeadCallStatus } from '../models/lead.model';

/** One entry in a Meta lead's `callAttempts` — one row per time the agent was triggered to call this lead. */
export interface ApiCallAttempt {
  callId: string;
  attemptedAt: string;
  /** Agent (agents._id) that placed this call; absent on older attempts. */
  agentId?: string;
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
  callStatus?: PageLeadCallStatus;
  lastCallError?: string;
  /** Agent (agents._id) that last handled this lead. */
  agentId?: string;
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
    leadgen_id: raw.leadgenId,
    page_id: raw.pageId,
    full_name: raw.fullName,
    phone_number: raw.phoneNumber,
    email: raw.email,
    custom_fields: raw.customFields ?? {},
    submitted_at: raw.metaCreatedAt,
    call_attempts_count: raw.callAttempts?.length ?? 0,
    call_status: raw.callStatus ?? null,
    last_call_error: raw.lastCallError ?? null,
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
  /** The schema's toJSON sends `id`; older responses carried the raw `_id`. */
  id?: string;
  _id?: string;
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
  /** Manual leads only — written by meta-adapter's call cron / manual calls. */
  callAttempts?: ApiCallAttempt[];
  callStatus?: PageLeadCallStatus;
  lastCallError?: string;
}

/**
 * Real API has no qualification/intent-summary/follow-up-action/outcome/call linkage —
 * those are set `null` until a future backend change adds them.
 */
export function fromApiAgentLead(raw: ApiAgentLead): AgentLead {
  return {
    id: raw.id ?? raw._id ?? raw.leadId,
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

export function fromApiManualLead(raw: ApiAgentLead): ManualLead {
  return {
    id: raw.id ?? raw._id ?? raw.leadId,
    lead_id: raw.leadId,
    full_name: raw.fullName ?? '',
    phone_number: raw.phoneNumber,
    email: raw.email ?? '',
    created_at: raw.leadCreatedAt ?? raw.createdAt,
    call_attempts_count: raw.callAttempts?.length ?? 0,
    call_status: raw.callStatus ?? null,
    last_call_error: raw.lastCallError ?? null,
  };
}

export function fromApiManualLeadsResponse(raw: ApiLeadsResponse<ApiAgentLead>): LeadsPage<ManualLead> {
  return {
    leads: raw.leads.map(fromApiManualLead),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}
