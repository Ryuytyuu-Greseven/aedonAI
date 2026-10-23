import { CallRecord } from '../app/core/models/call-record.model';

const DAYS = 86400000;

// The agent asks for the customer's name during the call, so it's only known
// for some calls.
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
        const occurredAt = new Date(dayStart + rng() * DAYS);
        const phoneNumber = `+1555${100 + Math.floor(rng() * 900)}${1000 + Math.floor(rng() * 9000)}`;
        const customerName = rng() < 0.3 ? null : pick(rng, CUSTOMER_NAMES);
        const duration_seconds = 20 + Math.floor(rng() * 220);

        records.push({
          id: `call-${profile.agentId}-${dayOffset}-${i}`,
          agent_id: profile.agentId,
          provider: 'twilio',
          direction,
          status: 'completed',
          occurred_at: occurredAt.toISOString(),
          ended_at: new Date(occurredAt.getTime() + duration_seconds * 1000).toISOString(),
          duration_seconds,
          phone_number: phoneNumber,
          customer_name: customerName,
          message_count: 4 + Math.floor(rng() * 16),
          summary: null,
        });
      }
    }
  }

  return records;
}

export const MOCK_CALL_RECORDS: CallRecord[] = generateCallRecords();
