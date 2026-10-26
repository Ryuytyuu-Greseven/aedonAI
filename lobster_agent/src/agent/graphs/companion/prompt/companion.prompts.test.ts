import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContext, describeNow, sanitizeSpeech } from './companion.prompts.js';

// Run with: npm test

describe('sanitizeSpeech', () => {
  it('removes stage directions, emoji and markdown so TTS never reads them', () => {
    assert.equal(sanitizeSpeech('*నవ్వుతూ* అబ్బా 😂 **నిజంగానా?**'), 'అబ్బా నిజంగానా?');
    assert.equal(sanitizeSpeech('[sighs] సరే సరే ❤️'), 'సరే సరే');
  });

  it('keeps plain Telugu untouched', () => {
    assert.equal(sanitizeSpeech('తిన్నావా?  లేదా మళ్ళీ స్కిప్ చేశావా?'), 'తిన్నావా? లేదా మళ్ళీ స్కిప్ చేశావా?');
  });
});

describe('describeNow', () => {
  it('speaks in IST', () => {
    // 14:30 UTC = 20:00 IST, Sunday
    assert.equal(describeNow(new Date('2026-10-25T14:30:00Z')), 'Sunday, evening (8:00 PM)');
    // 19:00 UTC = 00:30 IST, Monday
    assert.equal(describeNow(new Date('2026-10-25T19:00:00Z')), 'Monday, late night (12:30 AM)');
  });
});

describe('buildContext', () => {
  const now = new Date('2026-10-25T14:30:00Z');

  it('gives the time and her mood', () => {
    const context = buildContext({ now, moodLabel: 'playful' });
    assert.match(context, /Sunday, evening/);
    assert.match(context, /Your mood: Playful/);
  });

  it('leaves the mood out for comfort turns', () => {
    const context = buildContext({ now, moodLabel: 'jealous_tease', ignoreMood: true });
    assert.doesNotMatch(context, /Your mood/);
  });
});
