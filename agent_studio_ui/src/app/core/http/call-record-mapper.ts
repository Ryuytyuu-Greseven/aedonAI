import { CallDetail, CallMessage, CallRecord, CallSpeaker } from '../models/call-record.model';

/** Wire shape of one entry in `GET /api/agents/:id/calls`. */
export interface ApiCallRecord {
  id: string;
  agent_id: string;
  provider: CallRecord['provider'];
  direction: CallRecord['direction'];
  status: CallRecord['status'];
  occurred_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  phone_number: string | null;
  customer_name: string | null;
  message_count: number;
  summary: string | null;
}

/** Wire shape of `GET /api/agents/:id/calls/:callId`. */
export interface ApiCallDetail extends ApiCallRecord {
  messages: { id: string; speaker: 'customer' | 'ai_agent' | 'human_agent'; text: string; at: string }[];
}

const SPEAKERS: Record<ApiCallDetail['messages'][number]['speaker'], CallSpeaker> = {
  customer: 'customer',
  ai_agent: 'agent',
  human_agent: 'human',
};

export function fromApiCallRecord(raw: ApiCallRecord): CallRecord {
  return {
    id: raw.id,
    agent_id: raw.agent_id,
    provider: raw.provider,
    direction: raw.direction,
    status: raw.status,
    occurred_at: raw.occurred_at,
    ended_at: raw.ended_at ?? null,
    duration_seconds: raw.duration_seconds ?? null,
    phone_number: raw.phone_number ?? null,
    customer_name: raw.customer_name ?? null,
    message_count: raw.message_count ?? 0,
    summary: raw.summary ?? null,
  };
}

export function fromApiCallDetail(raw: ApiCallDetail): CallDetail {
  return {
    ...fromApiCallRecord(raw),
    messages: (raw.messages ?? []).map(
      (m): CallMessage => ({ id: m.id, speaker: SPEAKERS[m.speaker] ?? 'agent', text: m.text, at: m.at }),
    ),
  };
}
