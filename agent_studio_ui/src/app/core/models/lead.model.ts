import { CallRecord } from './call-record.model';

/** A real Facebook `leadgen` webhook submission — `GET /api/integrations/meta/leads`, company-wide across all connected Pages. */
export interface PageLead {
  id: string;
  page_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  custom_fields: Record<string, string>;
  submitted_at: string;
  /** How many times the agent has been triggered to call this lead — from `callAttempts.length`. */
  call_attempts_count: number;
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
