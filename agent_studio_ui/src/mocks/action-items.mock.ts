import { ActionItem } from '../app/core/models/action-item.model';
import { hashSeed, mulberry32, pick } from './call-records.mock';
import { generateAgentLeadsFor } from './leads.mock';

const MINUTES = 60000;
const HOURS = 3600000;
const DAYS = 86400000;

const CALLBACK_DELAYS: { label: string; ms: number }[] = [
  { label: '10 minutes', ms: 10 * MINUTES },
  { label: '25 minutes', ms: 25 * MINUTES },
  { label: '1 hour', ms: 1 * HOURS },
  { label: '2 days', ms: 2 * DAYS },
  { label: '3 days', ms: 3 * DAYS },
];

/**
 * Action Items are the successful (`outcome: 'success'`) Agent Leads for this agent, turned into
 * a follow-up callback task — see `leads.mock.ts`'s `generateAgentLeadsFor`. Deterministic per
 * `agentId`, same as the Agent/Page Leads generators, so it works for any real agent.
 */
export function generateActionItemsFor(agentId: string): ActionItem[] {
  return generateAgentLeadsFor(agentId)
    .filter((lead) => lead.outcome === 'success')
    .map((lead) => {
      const rng = mulberry32(hashSeed(`${lead.id}-action`));
      const delay = pick(rng, CALLBACK_DELAYS);
      const dueAt = new Date(new Date(lead.created_at).getTime() + delay.ms).toISOString();

      // `generateAgentLeadsFor` always populates `call`/`intent_summary`/`follow_up_action` —
      // they're nullable on `AgentLead` only because the real `GET /api/agents/:id/leads`
      // doesn't return them.
      const call = lead.call!;

      return {
        id: `action-${lead.id}`,
        agent_id: agentId,
        call,
        customer_name: lead.customer_name,
        phone_number: lead.phone_number,
        direction: call.direction,
        type: 'callback',
        summary: lead.intent_summary!,
        action_needed: `Follow up: ${lead.follow_up_action}`,
        due_at: dueAt,
        status: rng() < 0.25 ? 'done' : 'open',
        created_at: lead.created_at,
      };
    });
}
