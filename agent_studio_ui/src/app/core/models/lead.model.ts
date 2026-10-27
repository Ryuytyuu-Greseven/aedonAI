import { CallRecord } from './call-record.model';

/**
 * Where a Meta lead's outbound call stands, as written by meta-adapter's auto-call cron / manual
 * call endpoint. `null` = never picked up (auto-call pending, or past its 48h auto-call window).
 */
export type PageLeadCallStatus = 'dialing' | 'initiated' | 'failed' | 'skipped';

/** A real Facebook `leadgen` webhook submission — `GET /api/integrations/meta/leads`, company-wide across all connected Pages. */
export interface PageLead {
  id: string;
  /** Meta's lead id — what `POST /api/integrations/meta/leads/:leadgenId/call` takes. */
  leadgen_id: string;
  page_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  custom_fields: Record<string, string>;
  submitted_at: string;
  /** How many times the agent has been triggered to call this lead — from `callAttempts.length`. */
  call_attempts_count: number;
  call_status: PageLeadCallStatus | null;
  /** Why the last call couldn't be placed, when `call_status` is `failed`. */
  last_call_error: string | null;
}

/** Response of `POST /api/integrations/meta/leads/:leadgenId/call`. */
export interface PageLeadCallResult {
  leadgenId: string;
  callSid: string;
  agentId: string;
  callStatus: 'initiated';
}

/** Shared offset-pagination envelope for the leads-listing APIs (`agents-lead.md`). */
export interface LeadsPage<T> {
  leads: T[];
  total: number;
  page: number;
  limit: number;
}

/** Shared query params for the leads-listing APIs — identical shape for Meta leads and (future) agent leads. */
export interface LeadsQuery {
  page?: number;
  limit?: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export type LeadQualification = 'qualified' | 'unqualified' | 'needs_follow_up';

/** Whether this lead converted. A `success` lead is surfaced as an Action Item. */
export type LeadOutcome = 'success' | 'drop';

/**
 * The business-ready lead an agent produced. Real `GET /api/agents/:id/leads` — thin shape;
 * `call`/`intent_summary`/`qualification`/`follow_up_action`/`outcome` aren't returned by the
 * real API yet and are `null` until a future backend change adds them.
 */
export interface AgentLead {
  id: string;
  agent_id: string;
  customer_name: string | null;
  phone_number: string;
  email: string;
  custom_fields: Record<string, string>;
  source: string;
  created_at: string;
  call: CallRecord | null;
  intent_summary: string | null;
  qualification: LeadQualification | null;
  follow_up_action: string | null;
  outcome: LeadOutcome | null;
}
