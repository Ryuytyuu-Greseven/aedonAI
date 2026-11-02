import { CallRecord } from './call-record.model';

/**
 * Where a Meta lead's outbound call stands, as written by meta-adapter's auto-call cron / manual
 * call endpoint. `null` = never picked up (auto-call pending, or past its 48h auto-call window).
 */
export type PageLeadCallStatus = 'dialing' | 'initiated' | 'failed' | 'skipped';

/** How a placed call ended: anything not answered (busy, no answer, declined, failed) is `missed`. */
export type LeadCallOutcome = 'answered' | 'missed';

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
  /** How the latest call ended (carrier-reported); null until reported. */
  last_call_outcome: LeadCallOutcome | null;
  /** When a missed-call retry is scheduled; null when none is. */
  next_call_at: string | null;
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

/**
 * A lead the customer added by hand — uploaded from a sheet or typed into "Call a number"
 * (`GET /api/agents/:id/leads?source=manual`). meta-adapter's call cron dials each one once within
 * a week of being added, exactly like Page leads; after that it's a manual call.
 */
export interface ManualLead {
  id: string;
  /** What `POST /api/agents/:id/leads/manual/:leadId/call` takes. */
  lead_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  created_at: string;
  call_attempts_count: number;
  call_status: PageLeadCallStatus | null;
  last_call_error: string | null;
  last_call_outcome: LeadCallOutcome | null;
  next_call_at: string | null;
}

/** One row of `POST /api/agents/:id/leads/manual`. */
export interface ManualLeadInput {
  fullName: string;
  /** E.164. */
  phoneNumber: string;
  email: string;
}

/** Per-row outcome of an upload; `index` is the row's position in the submitted list. */
export interface ManualLeadsUploadResult {
  inserted: number;
  /** Already added to this agent today — accepted but not added again. */
  duplicates: { index: number; phoneNumber: string }[];
  /** Failed the server's checks — not added; fix and resubmit just these. */
  rejected: { index: number; lead: ManualLeadInput; errors: string[] }[];
}

/** Response of the manual lead call / dial endpoints. */
export interface ManualLeadCallResult {
  leadId: string;
  callSid: string;
  agentId: string;
  callStatus: 'initiated';
}

/** Shared label for a lead's call state, e.g. "Not answered" or "Called 2 times". */
export function leadCallStateLabel(lead: {
  call_status: PageLeadCallStatus | null;
  call_attempts_count: number;
  last_call_outcome: LeadCallOutcome | null;
}): string {
  if (lead.call_status === 'dialing') return 'Calling…';
  if (lead.call_status === 'failed') return 'Last call failed';
  if (lead.last_call_outcome === 'missed') return 'Not answered';
  const count = lead.call_attempts_count;
  if (count === 0) return 'Not called yet';
  return `Called ${count} time${count === 1 ? '' : 's'}`;
}

export type ScheduledCallStatus = 'pending' | 'dialing' | 'done' | 'failed' | 'cancelled';

/** A call the dialer will place later (`GET /api/agents/:id/scheduled-calls`) — missed-call retries for now. */
export interface ScheduledCall {
  id: string;
  lead_source: 'meta' | 'manual';
  /** Meta `leadgen_id` or manual `lead_id` — what that lead's Call endpoint takes. */
  lead_key: string;
  lead_name: string;
  phone_number: string;
  reason: 'missed_retry' | string;
  /** Retry number, 1-based. */
  attempt: number;
  due_at: string;
  status: ScheduledCallStatus;
  note: string | null;
  updated_at: string;
}

export interface ScheduledCallsPage {
  calls: ScheduledCall[];
  total: number;
  page: number;
  limit: number;
  /** The agent's IANA zone — due times are shown in it. */
  timezone: string;
  /** The agent's current missed-call retry limit, for "retry 2 of 4". */
  max_retries: number;
}
