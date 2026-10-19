import { AgentLead, LeadOutcome, LeadQualification } from '../app/core/models/lead.model';
import { hashSeed, mulberry32, MOCK_CALL_RECORDS, pick } from './call-records.mock';

// Page Leads are real now (GET /api/integrations/meta/leads, see lead.service.ts) — no mock here.

const INTENT_SUMMARIES = [
  'Customer is interested in a 3BHK unit and asked about current pricing and availability.',
  'Customer wants to schedule a site visit this weekend to see the model apartment.',
  'Customer is comparing this project against two others nearby and asked what sets it apart.',
  'Customer asked about home loan assistance and tie-ups with banks.',
  'Customer is ready to book but wants to negotiate on the booking amount first.',
  'Customer wants a callback with the sales manager to discuss a bulk/investor purchase.',
  'Customer asked for the payment plan and possession timeline before deciding.',
  'Customer wants floor plan options for a corner unit with better ventilation.',
  'Customer is relocating for work and wants to close the deal quickly, asked about fast-track paperwork.',
  'Customer wants to know about resale value and rental yield before committing.',
] as const;

const QUALIFICATIONS: LeadQualification[] = ['qualified', 'unqualified', 'needs_follow_up'];

// Likelihood a lead of this qualification actually converts (`outcome: 'success'`) — qualified
// leads mostly succeed, unqualified mostly drop, needs-follow-up is a toss-up.
const SUCCESS_CHANCE: Record<LeadQualification, number> = {
  qualified: 0.85,
  needs_follow_up: 0.4,
  unqualified: 0,
};

const FOLLOW_UPS: Record<LeadQualification, string[]> = {
  qualified: [
    'Send pricing sheet and schedule a site visit this week.',
    'Loop in the sales manager to finalize the unit and booking amount.',
    'Send the payment plan and possession timeline for sign-off.',
    'Share bank loan tie-up details and set up a follow-up call.',
  ],
  unqualified: [
    'No immediate budget — check back in a quarter.',
    'Looking in a different city/locality — not a fit for current inventory.',
    'Just browsing, no timeline yet — log and move on.',
  ],
  needs_follow_up: [
    'Waiting on site visit feedback — follow up in 3 days.',
    'Customer asked to be contacted after comparing nearby projects.',
    'Send additional floor plans and follow up next week.',
    'Spouse/family needs to see the property before deciding — schedule a joint visit.',
  ],
};

// Only the mock ids ('agent-1'/'agent-2'/'agent-3') ever appear as a `CallRecord.agent_id` here —
// real backend agents (live Mongo ids) never match one, so leads are generated per requested
// `agentId` below rather than filtered from a fixed pool keyed to those fake ids. Each lead still
// borrows a real `MOCK_CALL_RECORDS` entry (any original agent) for its `call` field, so "View
// call" resolves through `CallRecordService.getCallDetail()`, which only knows these mock ids.
const LEAD_OUTCOME_CALLS = MOCK_CALL_RECORDS.filter((r) => r.outcome === 'lead');

/** Deterministic per-agent Agent Leads — same agentId always yields the same leads within a session. */
export function generateAgentLeadsFor(agentId: string): AgentLead[] {
  const pickRng = mulberry32(hashSeed(`${agentId}-agent-leads`));
  const count = Math.min(LEAD_OUTCOME_CALLS.length, 5 + Math.floor(pickRng() * 5)); // 5-9

  const usedIndexes = new Set<number>();
  const leads: AgentLead[] = [];

  while (leads.length < count) {
    const idx = Math.floor(pickRng() * LEAD_OUTCOME_CALLS.length);
    if (usedIndexes.has(idx)) continue;
    usedIndexes.add(idx);

    const call = LEAD_OUTCOME_CALLS[idx];
    const detailRng = mulberry32(hashSeed(`${agentId}-${call.id}`));
    const qualification = pick(detailRng, QUALIFICATIONS);
    const outcome: LeadOutcome = detailRng() < SUCCESS_CHANCE[qualification] ? 'success' : 'drop';

    leads.push({
      id: `agent-lead-${agentId}-${call.id}`,
      agent_id: agentId,
      call,
      customer_name: call.customer_name,
      phone_number: call.phone_number,
      email: '',
      custom_fields: {},
      source: 'call',
      intent_summary: pick(detailRng, INTENT_SUMMARIES),
      qualification,
      follow_up_action: pick(detailRng, FOLLOW_UPS[qualification]),
      outcome,
      created_at: call.occurred_at,
    });
  }

  return leads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
