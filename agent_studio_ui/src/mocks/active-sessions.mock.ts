import { ActiveSession } from '../app/core/models/active-session.model';
import { CallDirection } from '../app/core/models/call-record.model';
import { hashSeed, mulberry32, pick } from './call-records.mock';

const CUSTOMER_NAMES = [
  'Dana Whitfield',
  'Marcus Bennett',
  'Priya Desai',
  'Owen Fitzgerald',
  'Yuki Tanaka',
  'Camila Torres',
  'Simone Laurent',
  'Kwame Asante',
  'Harriet Osei',
  'Lucas Bergman',
] as const;

const MINUTE = 60_000;

interface SlotConfig {
  /** How often (once per window) this slot re-decides whether it's occupied. */
  windowMs: number;
  /** Chance the slot is occupied for a given window — high enough to reliably show up for manual review. */
  activityChance: number;
  /** Upper bound on how far into the window the session may have "started", so duration varies from just-connected to several minutes in. */
  maxStartedAgoMs: number;
}

interface ActiveSessionProfile {
  agentId: string;
  inboundShare: number;
  slots: SlotConfig[];
}

// Mirrors the agent ids used in call-records.mock.ts's PROFILES.
// agent-1 is tuned to almost always show 2-3 concurrent sessions — including one
// long-running "anchor" slot with a multi-minute window, so opening Active
// Sessions reliably surfaces both a fresh call (seconds-only duration) and an
// established one (minutes:seconds duration) without waiting. agent-2 churns at
// a moderate rate (sometimes 0, sometimes 1-2) to exercise the empty state and
// list transitions. agent-3 stays sparse and outbound-heavy.
const PROFILES: ActiveSessionProfile[] = [
  {
    agentId: 'agent-1',
    inboundShare: 0.7,
    slots: [
      { windowMs: 6 * MINUTE, activityChance: 0.95, maxStartedAgoMs: 5 * MINUTE },
      { windowMs: 45_000, activityChance: 0.65, maxStartedAgoMs: 40_000 },
      { windowMs: 45_000, activityChance: 0.5, maxStartedAgoMs: 40_000 },
    ],
  },
  {
    agentId: 'agent-2',
    inboundShare: 0.65,
    slots: [
      { windowMs: 90_000, activityChance: 0.5, maxStartedAgoMs: 80_000 },
      { windowMs: 45_000, activityChance: 0.3, maxStartedAgoMs: 40_000 },
    ],
  },
  {
    agentId: 'agent-3',
    inboundShare: 0.2,
    slots: [{ windowMs: 45_000, activityChance: 0.35, maxStartedAgoMs: 40_000 }],
  },
];

interface FixedSession {
  customerName: (typeof CUSTOMER_NAMES)[number];
  phoneNumber: string;
  direction: CallDirection;
  /** How long ago (from page load) this call started — fixed, so it always ticks up predictably from a known baseline. */
  startedAgoMs: number;
}

// Evaluated once when the app loads, so fixed-session start times are anchored
// to "when you opened the app" and tick up normally afterwards, instead of
// resetting on every poll.
const SESSION_ANCHOR_MS = Date.now();

// Always-present baseline sessions, independent of the churn simulation below —
// guarantees a full, predictable spread (seconds-old, minutes-old, both
// directions) is visible the moment Active Sessions is opened, with no need to
// wait or reload. agent-3 intentionally has none, so its tab reliably
// demonstrates the empty state.
const FIXED_SESSIONS: Record<string, FixedSession[]> = {
  'agent-1': [
    { customerName: 'Dana Whitfield', phoneNumber: '+15554821190', direction: 'inbound', startedAgoMs: 14_000 },
    { customerName: 'Marcus Bennett', phoneNumber: '+15557743302', direction: 'outbound', startedAgoMs: 2 * MINUTE + 6_000 },
    { customerName: 'Priya Desai', phoneNumber: '+15559012234', direction: 'inbound', startedAgoMs: 7 * MINUTE + 40_000 },
  ],
  'agent-2': [{ customerName: 'Owen Fitzgerald', phoneNumber: '+15556652291', direction: 'inbound', startedAgoMs: 52_000 }],
  'agent-3': [],
};

function fixedSessions(agentId: string): ActiveSession[] {
  return (FIXED_SESSIONS['agent-1'] ?? []).map((fixed, index) => ({
    id: `active-${agentId}-fixed${index}`,
    agentId,
    customerName: fixed.customerName,
    phoneNumber: fixed.phoneNumber,
    direction: fixed.direction,
    startedAt: new Date(SESSION_ANCHOR_MS - fixed.startedAgoMs).toISOString(),
  }));
}

function churnSessions(agentId: string, atMs: number): ActiveSession[] {
  const profile = PROFILES.find((p) => p.agentId === agentId);
  if (!profile) return [];

  const sessions: ActiveSession[] = [];

  profile.slots.forEach((slot, slotIndex) => {
    const windowIndex = Math.floor(atMs / slot.windowMs);
    const rng = mulberry32(hashSeed(`${agentId}-slot${slotIndex}-w${windowIndex}`));
    if (rng() >= slot.activityChance) return;

    const windowStart = windowIndex * slot.windowMs;
    const direction: CallDirection = rng() < profile.inboundShare ? 'inbound' : 'outbound';
    const customerName = pick(rng, CUSTOMER_NAMES);
    const phoneNumber = `+1555${100 + Math.floor(rng() * 900)}${1000 + Math.floor(rng() * 9000)}`;
    const startedAt = new Date(windowStart + rng() * slot.maxStartedAgoMs).toISOString();

    sessions.push({
      id: `active-${agentId}-slot${slotIndex}-w${windowIndex}`,
      agentId,
      customerName,
      phoneNumber,
      direction,
      startedAt,
    });
  });

  return sessions;
}

/**
 * Mock-only generator standing in for a real "list active calls" endpoint.
 * Combines an always-present fixed baseline (see FIXED_SESSIONS) with a
 * probabilistic layer that starts/ends sessions across polls, so the screen is
 * both immediately reviewable and demonstrates live churn over time.
 */
export function generateActiveSessions(agentId: string, atMs: number = Date.now()): ActiveSession[] {
  return [...fixedSessions(agentId), ...churnSessions(agentId, atMs)];
}
