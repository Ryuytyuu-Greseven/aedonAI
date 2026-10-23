import { DEEPGRAM_VOICES } from './deepgram.voices';
import { GOOGLE_VOICES } from './google.voices';
import { SARVAM_VOICES } from './sarvam.voices';
import { VOICE_CODES } from './voice-codes';
import { resolveVoice } from './voice-mapper';

describe('voice mapper', () => {
  it('maps every voice code for every provider, to a distinct voice', () => {
    for (const voices of [GOOGLE_VOICES, SARVAM_VOICES, DEEPGRAM_VOICES]) {
      expect(Object.keys(voices).sort()).toEqual([...VOICE_CODES].sort());
      expect(new Set(Object.values(voices)).size).toBe(VOICE_CODES.length);
    }
  });

  it('resolves a code to the provider voice', () => {
    expect(resolveVoice('google', 'male_1')).toBe('Charon');
    expect(resolveVoice('sarvam', 'male_1')).toBe(SARVAM_VOICES.male_1);
    expect(resolveVoice('deepgram', 'female_2')).toBe('aura-2-andromeda-en');
  });

  it('keeps a raw Google voice name working on Google, and defaults it elsewhere', () => {
    expect(resolveVoice('google', 'Aoede')).toBe('Aoede');
    expect(resolveVoice('sarvam', 'Aoede')).toBe(SARVAM_VOICES.female_1);
  });

  it('falls back to the default voice when none is set', () => {
    expect(resolveVoice('google', undefined)).toBe('Aoede');
    expect(resolveVoice('sarvam', null)).toBe(SARVAM_VOICES.female_1);
    expect(resolveVoice('deepgram', '')).toBe('aura-2-thalia-en');
  });
});
