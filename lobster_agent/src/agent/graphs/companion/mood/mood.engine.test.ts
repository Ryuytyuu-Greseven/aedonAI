import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applySignals,
  decayMood,
  initialMood,
  JEALOUSY_CAP,
  labelMood,
  Mood,
  MoodSignals,
  restingMood,
} from './mood.engine.js';

// Run with: npm test

// 2026-10-25 14:30 UTC = 20:00 IST, a Sunday evening.
const EVENING = new Date('2026-10-25T14:30:00Z');
const HOUR = 60 * 60_000;

const neutral: MoodSignals = {
  userEmotion: 'neutral',
  flirtedOrComplimented: false,
  otherGirlMentioned: false,
  dismissiveOrRude: false,
  apologized: false,
  sharedSomething: false,
};

function mood(overrides: Partial<Mood> = {}): Mood {
  return { ...initialMood(EVENING), ...overrides };
}

describe('restingMood', () => {
  it('is the same all day, so a day has one mood', () => {
    const morning = restingMood(new Date('2026-10-25T05:30:00Z'));
    const evening = restingMood(EVENING);
    assert.equal(morning.valence, evening.valence);
  });

  it('is sleepier late at night than in the evening', () => {
    const lateNight = restingMood(new Date('2026-10-25T20:30:00Z')); // 02:00 IST next day
    const sameDayNight = restingMood(new Date('2026-10-25T18:00:00Z')); // 23:30 IST
    assert.ok(sameDayNight.energy < restingMood(EVENING).energy);
    assert.ok(lateNight.energy <= 0.6);
  });
});

describe('decayMood', () => {
  it('eases jealousy away within the hour', () => {
    const jealous = mood({ jealousy: JEALOUSY_CAP, updatedAt: EVENING });
    const later = decayMood(jealous, new Date(EVENING.getTime() + HOUR));
    assert.ok(later.jealousy < 0.1, `jealousy still ${later.jealousy}`);
  });

  it('keeps affection for much longer than jealousy', () => {
    const warm = mood({ affection: 1, jealousy: JEALOUSY_CAP, updatedAt: EVENING });
    const later = decayMood(warm, new Date(EVENING.getTime() + HOUR));
    assert.ok(later.affection > 0.95);
  });

  it('does nothing for zero elapsed time', () => {
    const m = mood({ valence: -0.5, updatedAt: EVENING });
    assert.equal(decayMood(m, EVENING).valence, -0.5);
  });
});

describe('applySignals', () => {
  it('turns another girl into playful jealousy, capped', () => {
    let m = mood();
    for (let i = 0; i < 5; i++) m = applySignals(m, { ...neutral, otherGirlMentioned: true });
    assert.equal(m.jealousy, JEALOUSY_CAP);
    assert.equal(labelMood(m), 'jealous_tease');
  });

  it('an apology melts jealousy and sulking', () => {
    const upset = mood({ jealousy: 0.4, valence: -0.3 });
    const after = applySignals(upset, { ...neutral, apologized: true });
    assert.ok(after.jealousy < 0.3);
    assert.ok(after.valence > upset.valence);
  });

  it('softens and stops teasing when the friend is sad', () => {
    const after = applySignals(mood({ playfulness: 0.7 }), { ...neutral, userEmotion: 'sad' });
    assert.ok(after.playfulness < 0.5);
    assert.ok(after.affection > mood().affection);
  });

  it('sulks when brushed off', () => {
    let m = mood({ valence: 0.1 });
    m = applySignals(m, { ...neutral, dismissiveOrRude: true });
    assert.equal(labelMood(m), 'sulky');
  });
});

describe('labelMood', () => {
  it('reads sleepy at low energy', () => {
    assert.equal(labelMood(mood({ energy: 0.2, jealousy: 0, valence: 0.3 })), 'sleepy');
  });

  it('reads bubbly when happy and energetic', () => {
    assert.equal(labelMood(mood({ valence: 0.8, energy: 0.9, jealousy: 0 })), 'bubbly');
  });
});
