/**
 * Which vendor handles each half of the voice pipeline. Chosen independently
 * via env, so e.g. Deepgram can transcribe while Sarvam speaks.
 *
 *   STT_PROVIDER          = deepgram (default) | google | sarvam
 *   STT_FALLBACK_PROVIDER = deepgram (default) | none — takes over a Sarvam
 *                           call whose stream can't open or drops mid-call
 *   TTS_PROVIDER          = google (default)   | sarvam | openai
 *
 * Unknown values throw at startup rather than silently falling back — a typo
 * here would otherwise ship calls on the wrong vendor without anyone noticing.
 */
export type SttProviderName = 'deepgram' | 'google' | 'sarvam';
export type TtsProviderName = 'google' | 'sarvam' | 'openai';

const STT_PROVIDERS: readonly SttProviderName[] = [
  'deepgram',
  'google',
  'sarvam',
];

// 'gemini' is the historical name of the Google Cloud TTS path (it lives in
// GeminiService), so it's accepted as an alias.
const TTS_ALIASES: Record<string, TtsProviderName> = {
  google: 'google',
  gemini: 'google',
  sarvam: 'sarvam',
  openai: 'openai',
};

export function resolveSttProvider(raw: string | undefined): SttProviderName {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'deepgram';
  if ((STT_PROVIDERS as readonly string[]).includes(value)) {
    return value as SttProviderName;
  }
  throw new Error(
    `Invalid STT_PROVIDER "${raw}" — expected one of: ${STT_PROVIDERS.join(', ')}`,
  );
}

export function resolveSttFallback(raw: string | undefined): 'deepgram' | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value || value === 'deepgram') return 'deepgram';
  if (value === 'none') return null;
  throw new Error(
    `Invalid STT_FALLBACK_PROVIDER "${raw}" — expected one of: deepgram, none`,
  );
}

/** `fallback` is AI_PROVIDER, which TTS_PROVIDER used to default to. */
export function resolveTtsProvider(
  raw: string | undefined,
  fallback?: string,
): TtsProviderName {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value)
    return TTS_ALIASES[(fallback ?? '').trim().toLowerCase()] ?? 'google';
  const resolved = TTS_ALIASES[value];
  if (resolved) return resolved;
  throw new Error(
    `Invalid TTS_PROVIDER "${raw}" — expected one of: ${Object.keys(TTS_ALIASES).join(', ')}`,
  );
}
