import {
  resolveSttFallback,
  resolveSttProvider,
  resolveTtsProvider,
} from './speech.config';
import {
  speakableLanguages,
  toSarvamTtsLanguage,
  toShortLanguage,
} from './language-codes';
import { LanguageTracker } from './language-tracker';

describe('speech provider config', () => {
  it('defaults STT to deepgram and accepts each provider', () => {
    expect(resolveSttProvider(undefined)).toBe('deepgram');
    expect(resolveSttProvider(' Sarvam ')).toBe('sarvam');
    expect(resolveSttProvider('google')).toBe('google');
  });

  it('falls back to Deepgram by default, or not at all with none', () => {
    expect(resolveSttFallback(undefined)).toBe('deepgram');
    expect(resolveSttFallback('none')).toBeNull();
    expect(() => resolveSttFallback('google')).toThrow(/STT_FALLBACK_PROVIDER/);
  });

  it('rejects an unknown STT provider instead of falling back', () => {
    expect(() => resolveSttProvider('whisper')).toThrow(/STT_PROVIDER/);
  });

  it('resolves TTS, with gemini as an alias of google and AI_PROVIDER as the fallback', () => {
    expect(resolveTtsProvider(undefined)).toBe('google');
    expect(resolveTtsProvider('gemini')).toBe('google');
    expect(resolveTtsProvider('SARVAM')).toBe('sarvam');
    expect(resolveTtsProvider(undefined, 'openai')).toBe('openai');
    expect(resolveTtsProvider('', 'gemini')).toBe('google');
  });

  it('rejects an unknown TTS provider — e.g. the old TTS_PROVIDER=deepgram', () => {
    expect(() => resolveTtsProvider('deepgram')).toThrow(/TTS_PROVIDER/);
  });
});

describe('language codes', () => {
  it('converts between BCP-47 and the short codes the pipeline carries', () => {
    expect(toShortLanguage('te-IN')).toBe('te');
    expect(toShortLanguage('unknown')).toBeNull();
    expect(toShortLanguage(null)).toBeNull();
    expect(toSarvamTtsLanguage('hi')).toBe('hi-IN');
    expect(toSarvamTtsLanguage('ur')).toBe('en-IN');
  });

  it('knows which languages each TTS can voice', () => {
    expect(speakableLanguages('google').has('mr')).toBe(false);
    expect(speakableLanguages('sarvam').has('mr')).toBe(true);
  });
});

describe('LanguageTracker', () => {
  const tracker = () =>
    new LanguageTracker({
      initial: 'te',
      supported: new Set(['en', 'hi', 'te']),
      minConfidence: 0.8,
      minWords: 2,
    });

  it('switches on one confident, non-trivial utterance', () => {
    const t = tracker();
    expect(t.observe('en', 0.99, 'Is it available in red?')).toBe('en');
    expect(t.language).toBe('en');
  });

  it('ignores low confidence, one-word replies and unspeakable languages', () => {
    const t = tracker();
    expect(t.observe('en', 0.5, 'Is it available in red?')).toBe('te');
    expect(t.observe('en', 0.99, 'ok')).toBe('te');
    expect(t.observe('ur', 0.99, 'yeh kitne ka hai')).toBe('te');
    expect(t.observe(null, null, 'something')).toBe('te');
  });

  it('switches without a probability when the provider reports none', () => {
    expect(tracker().observe('hi', null, 'kitne ka hai')).toBe('hi');
  });

  it('resets to a configured language only if it is speakable', () => {
    const t = tracker();
    t.reset('hi');
    expect(t.language).toBe('hi');
    t.reset('mr');
    expect(t.language).toBe('hi');
  });
});
