import { CallRecord } from '../models/call-record.model';

/** Wire shape of one entry in `GET /api/agents/:id/calls` — raw Mongo document, `_id` not `id`. */
export interface ApiCallRecord {
  _id: string;
  agent_id: string;
  direction: CallRecord['direction'];
  occurred_at: string;
  outcome: CallRecord['outcome'];
  duration_seconds: number;
  total_tokens: number;
  phone_number: string;
  customer_name: string | null;
  cost_usd: number;
}

export function fromApiCallRecord(raw: ApiCallRecord): CallRecord {
  return {
    id: raw._id,
    agent_id: raw.agent_id,
    direction: raw.direction,
    occurred_at: raw.occurred_at,
    outcome: raw.outcome,
    duration_seconds: raw.duration_seconds,
    total_tokens: raw.total_tokens,
    phone_number: raw.phone_number,
    customer_name: raw.customer_name,
    cost_usd: raw.cost_usd,
  };
}
