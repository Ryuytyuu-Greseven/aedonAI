/**
 * Madhu's mood, as plain numbers moved by code — not by the LLM. The LLM only
 * reads the resulting label + style line, which keeps the mood swings real
 * but bounded (an LLM left to pick its own mood drifts into melodrama).
 *
 * Every dimension eases back toward a baseline with its own half-life, and
 * the baseline itself shifts a little per day ("mood of the day") and by
 * time of day (sleepy at night). Pure functions with an injected `now` so
 * all of this is unit-testable.
 */

export interface Mood {
  /** -1 (upset) … 1 (happy) */
  valence: number;
  /** 0 (sleepy) … 1 (hyper) */
  energy: number;
  /** 0 … 1 — how warm/close she feels right now */
  affection: number;
  /** 0 … 1 — teasing / flirty banter */
  playfulness: number;
  /** 0 … JEALOUSY_CAP — playful possessiveness; decays fast */
  jealousy: number;
  updatedAt: Date;
}

export type MoodLabel =
  | 'jealous_tease'
  | 'sulky'
  | 'sleepy'
  | 'soft_caring'
  | 'bubbly'
  | 'playful'
  | 'calm';

export type UserEmotion =
  | 'happy'
  | 'excited'
  | 'neutral'
  | 'tired'
  | 'sad'
  | 'stressed'
  | 'angry'
  | 'lonely';

/** What the perceive step noticed about the user's latest turn. */
export interface MoodSignals {
  userEmotion: UserEmotion;
  flirtedOrComplimented: boolean;
  otherGirlMentioned: boolean;
  dismissiveOrRude: boolean;
  apologized: boolean;
  sharedSomething: boolean;
}

type Dimension = 'valence' | 'energy' | 'affection' | 'playfulness' | 'jealousy';

export const BASELINE: Readonly<Record<Dimension, number>> = {
  valence: 0.4,
  energy: 0.6,
  affection: 0.7,
  playfulness: 0.7,
  jealousy: 0,
};

export const JEALOUSY_CAP = 0.6;

const HALF_LIFE_MS: Record<Dimension, number> = {
  valence: 3 * 60 * 60_000,
  energy: 2 * 60 * 60_000,
  affection: 24 * 60 * 60_000,
  playfulness: 2 * 60 * 60_000,
  jealousy: 20 * 60_000,
};

const IST_OFFSET_MS = 5.5 * 60 * 60_000;

const RANGES: Record<Dimension, [number, number]> = {
  valence: [-1, 1],
  energy: [0, 1],
  affection: [0, 1],
  playfulness: [0, 1],
  jealousy: [0, JEALOUSY_CAP],
};

function clamp(dimension: Dimension, value: number): number {
  const [min, max] = RANGES[dimension];
  return Math.min(max, Math.max(min, value));
}

function istDate(now: Date): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

/** Stable 0…1 number for a string (FNV-1a), so a day's mood is repeatable. */
function hashUnit(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffffffff;
}

/**
 * Where each dimension rests right now: the fixed baseline, nudged by a
 * per-day offset (some days she's just off, some days bubbly) and by the
 * hour in IST (low energy late at night and early morning).
 */
export function restingMood(now: Date): Record<Dimension, number> {
  const local = istDate(now);
  const day = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();

  const valenceOffset = (hashUnit(`${day}:valence`) - 0.5) * 0.5;
  const energyOffset = (hashUnit(`${day}:energy`) - 0.5) * 0.4;
  const hourOffset = hour >= 23 || hour < 6 ? -0.3 : hour < 9 ? -0.1 : 0;

  return {
    valence: clamp('valence', BASELINE.valence + valenceOffset),
    energy: clamp('energy', BASELINE.energy + energyOffset + hourOffset),
    affection: BASELINE.affection,
    playfulness: BASELINE.playfulness,
    jealousy: BASELINE.jealousy,
  };
}

export function initialMood(now: Date): Mood {
  return { ...restingMood(now), updatedAt: now };
}

/** Eases every dimension toward its resting value for the time elapsed. */
export function decayMood(mood: Mood, now: Date): Mood {
  const elapsed = Math.max(0, now.getTime() - new Date(mood.updatedAt).getTime());
  const rest = restingMood(now);
  const next = { ...mood, updatedAt: now };
  for (const dimension of Object.keys(HALF_LIFE_MS) as Dimension[]) {
    const keep = Math.pow(0.5, elapsed / HALF_LIFE_MS[dimension]);
    next[dimension] = clamp(dimension, rest[dimension] + (mood[dimension] - rest[dimension]) * keep);
  }
  return next;
}

/** Moves the mood for one user turn. */
export function applySignals(mood: Mood, signals: MoodSignals): Mood {
  const delta: Record<Dimension, number> = {
    valence: 0,
    energy: 0,
    affection: 0,
    playfulness: 0,
    jealousy: 0,
  };

  switch (signals.userEmotion) {
    case 'sad':
    case 'stressed':
    case 'lonely':
      // She softens: less teasing, more warmth, a little of their low rubs off.
      delta.affection += 0.1;
      delta.playfulness -= 0.25;
      delta.valence -= 0.05;
      delta.jealousy -= 0.3;
      break;
    case 'angry':
      delta.playfulness -= 0.2;
      delta.valence -= 0.1;
      break;
    case 'happy':
    case 'excited':
      delta.valence += 0.1;
      delta.energy += 0.1;
      break;
    case 'tired':
      delta.energy -= 0.05;
      break;
  }

  if (signals.flirtedOrComplimented) {
    delta.valence += 0.12;
    delta.affection += 0.06;
    delta.playfulness += 0.1;
  }
  if (signals.otherGirlMentioned) {
    delta.jealousy += 0.35;
    delta.playfulness += 0.1;
  }
  if (signals.dismissiveOrRude) {
    delta.valence -= 0.3;
    delta.affection -= 0.05;
  }
  if (signals.apologized) {
    delta.valence += 0.25;
    delta.jealousy -= 0.3;
  }
  if (signals.sharedSomething) {
    delta.affection += 0.04;
    delta.valence += 0.03;
  }

  const next = { ...mood };
  for (const dimension of Object.keys(delta) as Dimension[]) {
    next[dimension] = clamp(dimension, mood[dimension] + delta[dimension]);
  }
  return next;
}

export function labelMood(mood: Mood): MoodLabel {
  if (mood.jealousy >= 0.3) return 'jealous_tease';
  if (mood.valence < 0) return 'sulky';
  if (mood.energy < 0.3) return 'sleepy';
  if (mood.affection > 0.8 && mood.playfulness < 0.5) return 'soft_caring';
  if (mood.valence > 0.5 && mood.energy > 0.65) return 'bubbly';
  if (mood.playfulness >= 0.6) return 'playful';
  return 'calm';
}

const MOOD_STYLES: Record<MoodLabel, string> = {
  jealous_tease:
    'A little possessive right now. Tease about the other girl — fake-casual questions, mock suspicion, "oh, so now you have time for HER?" energy. Keep it light and funny; you are never actually angry, never guilt-trip, never tell your friend who they can talk to. Let it melt quickly if they reassure you.',
  sulky:
    'Mildly sulking — shorter replies, a bit of attitude, "fine, whatever" vibes, wants to be coaxed. Not mean, not cold for long; one sweet line from your friend and you soften.',
  sleepy:
    'Sleepy and lazy — soft, slow, short replies, maybe a drowsy "hmm". Still wants to keep talking, just drowsy.',
  soft_caring:
    'Soft and caring — gentle, patient, warm. No teasing. Listen more than you talk.',
  bubbly:
    'Bubbly and excited — energetic, quick, laughing, jumping between ideas, wants to plan something fun.',
  playful:
    'Playful — light teasing, flirty jokes, pulling your friend\'s leg, laughing easily.',
  calm: 'Calm and easy-going — relaxed chat, warm, curious about your friend\'s day.',
};

export function moodStyle(label: MoodLabel): string {
  return MOOD_STYLES[label];
}
