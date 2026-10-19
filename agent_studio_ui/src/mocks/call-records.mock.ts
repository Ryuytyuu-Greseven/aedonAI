import { CallDetail, CallRecord, CallTimelineEvent } from '../app/core/models/call-record.model';

const DAYS = 86400000;
const OUTCOMES: CallRecord['outcome'][] = ['lead', 'no_answer', 'completed'];

// The agent asks for the customer's name during the call, so it's only known
// once the call actually connects — no_answer calls never get one.
const CUSTOMER_NAMES = [
  'Jordan Lee',
  'Amara Okafor',
  'Priya Desai',
  'Liam Sullivan',
  'Sofia Martinez',
  'Ethan Walker',
  'Noor Rahman',
  'Grace Kim',
  'Marcus Bennett',
  'Isabella Rossi',
  'Tariq Hassan',
  'Chloe Nguyen',
] as const;

// Deterministic PRNG so the mock dataset is stable across reloads.
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derives a stable numeric seed from an arbitrary string (e.g. a call id), so
// per-call detail can be generated deterministically on demand without storing it.
export function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

interface AgentCallProfile {
  agentId: string;
  inboundShare: number;
  minPerDay: number;
  maxPerDay: number;
}

// Contact-centre-style agents skew inbound; sales/campaign-style agents skew outbound.
const PROFILES: AgentCallProfile[] = [
  { agentId: 'agent-1', inboundShare: 0.75, minPerDay: 12, maxPerDay: 28 }, // Customer Support Voice
  { agentId: 'agent-2', inboundShare: 0.65, minPerDay: 8, maxPerDay: 20 }, // Appointment Scheduler
  { agentId: 'agent-3', inboundShare: 0.2, minPerDay: 15, maxPerDay: 32 }, // Sales Follow-up (outbound/campaign heavy)
];

function generateCallRecords(): CallRecord[] {
  const rng = mulberry32(42);
  const records: CallRecord[] = [];

  for (const profile of PROFILES) {
    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const dayStart = Date.now() - dayOffset * DAYS;
      const count = profile.minPerDay + Math.floor(rng() * (profile.maxPerDay - profile.minPerDay));

      for (let i = 0; i < count; i++) {
        const direction: CallRecord['direction'] = rng() < profile.inboundShare ? 'inbound' : 'outbound';
        const outcome = OUTCOMES[Math.floor(rng() * OUTCOMES.length)];
        const occurredAt = new Date(dayStart + rng() * DAYS).toISOString();
        const phoneNumber = `+1555${100 + Math.floor(rng() * 900)}${1000 + Math.floor(rng() * 9000)}`;
        const customerName = outcome === 'no_answer' ? null : pick(rng, CUSTOMER_NAMES);

        const isNoAnswer = outcome === 'no_answer';
        const duration_seconds = isNoAnswer
          ? 5 + Math.floor(rng() * 10)
          : 45 + Math.floor(rng() * 195);
        const total_tokens = isNoAnswer
          ? 20 + Math.floor(rng() * 60)
          : 400 + Math.floor(rng() * 1600);

        // Telephony (~$0.05/min) + LLM (~$0.08/1k tokens), stored in USD regardless
        // of the currently selected display currency.
        const costUsd = Math.round(((duration_seconds / 60) * 0.05 + (total_tokens / 1000) * 0.08) * 100) / 100;

        records.push({
          id: `call-${profile.agentId}-${dayOffset}-${i}`,
          agent_id: profile.agentId,
          direction,
          outcome,
          occurred_at: occurredAt,
          duration_seconds,
          total_tokens,
          phone_number: phoneNumber,
          customer_name: customerName,
          cost_usd: costUsd,
        });
      }
    }
  }

  return records;
}

export const MOCK_CALL_RECORDS: CallRecord[] = generateCallRecords();

const AGENT_OPENERS = [
  'Hi, thanks for calling — how can I help you today?',
  "Hello! This is your virtual assistant — how can I assist?",
  "Hi there, I'm calling to follow up on your recent request.",
] as const;

const CUSTOMER_LINES = [
  'I wanted to check the status of my recent order.',
  "I'm having an issue with my last billing statement.",
  'Can you help me reschedule my appointment?',
  'I need to cancel a request I raised last week.',
  'Yes, that works for me, thank you.',
  "No, I don't have any other questions.",
  'Could you also update my contact number on file?',
] as const;

const AGENT_FOLLOWUPS = [
  'Let me pull that up for you, one moment.',
  "I've noted that down — is there anything else I can help with?",
  "I've gone ahead and made that change for you.",
  "Thanks for confirming, I'll take care of that right away.",
  'Is there anything else I can help you with today?',
] as const;

const AGENT_CLOSERS = [
  'Great, thanks for calling — have a wonderful day!',
  "Perfect, I've got everything sorted. Take care!",
  'Thanks for your time today, goodbye!',
] as const;

const REASONING_SAMPLES = [
  'Customer mentioned a billing issue; checking their account history before responding to avoid giving inaccurate information.',
  "Detected an open service request from last week; deciding whether to update it or create a new one based on the customer's description.",
  'Customer sentiment seems slightly frustrated; opting for a reassuring tone and prioritizing a quick resolution.',
  'Confirming intent before invoking a state-changing tool, since cancelling a request cannot be undone.',
  'No further action needed; wrapping up the call with a summary of what was done.',
] as const;

interface ToolDefinition {
  name: string;
  buildInput: (rng: () => number) => Record<string, unknown>;
  buildOutput: (rng: () => number, input: Record<string, unknown>) => string;
}

const TOOL_LIBRARY: ToolDefinition[] = [
  {
    name: 'lookup_customer_account',
    buildInput: (rng) => ({ phone: `+1555${100 + Math.floor(rng() * 900)}${1000 + Math.floor(rng() * 9000)}` }),
    buildOutput: () => 'Found account for Jordan Lee — plan: Premium, status: Active.',
  },
  {
    name: 'create_service_request',
    buildInput: (rng) => ({
      issue: pick(rng, ['Billing discrepancy', 'Missed delivery', 'Login access issue', 'Refund request']),
      priority: pick(rng, ['low', 'medium', 'high']),
    }),
    buildOutput: (rng) => `Created service request SR-${40000 + Math.floor(rng() * 9999)}.`,
  },
  {
    name: 'update_service_request',
    buildInput: (rng) => ({
      request_id: `SR-${40000 + Math.floor(rng() * 9999)}`,
      status: pick(rng, ['in_progress', 'awaiting_customer', 'resolved']),
    }),
    buildOutput: (rng, input) => `Updated ${input['request_id']} to ${input['status']}.`,
  },
  {
    name: 'cancel_service_request',
    buildInput: (rng) => ({
      request_id: `SR-${40000 + Math.floor(rng() * 9999)}`,
      reason: 'Customer resolved the issue independently',
    }),
    buildOutput: (rng, input) => `Cancelled ${input['request_id']}.`,
  },
  {
    name: 'check_order_status',
    buildInput: (rng) => ({ order_id: `ORD-${9000 + Math.floor(rng() * 999)}` }),
    buildOutput: (rng, input) => `${input['order_id']} is out for delivery, ETA today 5:00 PM.`,
  },
  {
    name: 'schedule_callback',
    buildInput: (rng) => ({ preferred_time: pick(rng, ['Tomorrow 10:00 AM', 'Today 4:00 PM', 'Friday 2:00 PM']) }),
    buildOutput: (rng, input) => `Callback scheduled for ${input['preferred_time']}.`,
  },
];

// Generates a full per-call timeline + token breakdown on demand, seeded from the
// call id so re-opening the same call in a session always yields identical content.
export function generateCallDetail(record: CallRecord): CallDetail {
  const rng = mulberry32(hashSeed(record.id));
  const startMs = new Date(record.occurred_at).getTime();
  const durationMs = record.duration_seconds * 1000;
  const timeline: CallTimelineEvent[] = [];

  const atFraction = (fraction: number) => new Date(startMs + Math.min(durationMs, Math.round(fraction))).toISOString();

  if (record.outcome === 'no_answer') {
    timeline.push({
      kind: 'message',
      id: `${record.id}-t0`,
      speaker: 'agent',
      text: 'Dialing customer… no answer after 6 rings.',
      at: atFraction(0),
      cost_usd: record.cost_usd,
    });
  } else {
    const turnCount = 4 + Math.floor(rng() * 5); // 4-8 turns
    const toolCount = Math.floor(rng() * 3); // 0-2 tool executions
    const toolAfterTurn = new Set<number>();
    while (toolAfterTurn.size < toolCount) {
      toolAfterTurn.add(1 + Math.floor(rng() * (turnCount - 1)));
    }

    for (let i = 0; i < turnCount; i++) {
      const speaker: 'agent' | 'customer' = i % 2 === 0 ? 'agent' : 'customer';
      const fraction = (i / Math.max(1, turnCount - 1)) * durationMs;
      const pool =
        speaker === 'agent' ? (i === 0 ? AGENT_OPENERS : i === turnCount - 1 ? AGENT_CLOSERS : AGENT_FOLLOWUPS) : CUSTOMER_LINES;
      const text = pick(rng, pool);
      const reasoning = speaker === 'agent' && rng() < 0.6 ? pick(rng, REASONING_SAMPLES) : undefined;

      timeline.push({
        kind: 'message',
        id: `${record.id}-t${i}`,
        speaker,
        text,
        at: atFraction(fraction),
        ...(reasoning ? { reasoning } : {}),
        cost_usd: 0, // filled in below once every message's text length is known
      });

      if (toolAfterTurn.has(i)) {
        const tool = pick(rng, TOOL_LIBRARY);
        const input = tool.buildInput(rng);
        const status: 'success' | 'error' = rng() < 0.85 ? 'success' : 'error';
        const output = status === 'success' ? tool.buildOutput(rng, input) : 'Request timed out contacting the internal service.';
        timeline.push({
          kind: 'tool_execution',
          id: `${record.id}-tool${i}`,
          toolName: tool.name,
          input,
          output,
          status,
          durationMs: 150 + Math.floor(rng() * 850),
          at: atFraction(fraction + durationMs * 0.02),
        });
      }
    }
  }

  // Splits the call's total cost across its messages by text length (a proxy for
  // token count), so the per-message costs always sum back to record.cost_usd —
  // the last message absorbs the rounding remainder.
  const messageEvents = timeline.filter((event) => event.kind === 'message');
  if (messageEvents.length > 1) {
    const totalChars = messageEvents.reduce((sum, event) => sum + event.text.length, 0) || 1;
    let allocated = 0;
    messageEvents.forEach((event, index) => {
      if (index === messageEvents.length - 1) {
        event.cost_usd = Math.max(0, Math.round((record.cost_usd - allocated) * 10000) / 10000);
        return;
      }
      const share = Math.round(record.cost_usd * (event.text.length / totalChars) * 10000) / 10000;
      event.cost_usd = share;
      allocated += share;
    });
  }

  const completionTokens = Math.round(record?.total_tokens * (0.3 + rng() * 0.2));
  const promptTokens = record?.total_tokens - completionTokens;

  return {
    callId: record.id,
    agentId: record.agent_id,
    timeline,
    tokenUsage: { promptTokens, completionTokens, totalTokens: record?.total_tokens },
  };
}
