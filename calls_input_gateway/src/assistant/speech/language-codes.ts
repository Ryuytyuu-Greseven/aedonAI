import type { TtsProviderName } from './speech.config';

/**
 * The pipeline carries short language codes ('en', 'te', …) in
 * session.language / agentDetails.currentLanguage. Providers speak BCP-47
 * ('te-IN'); these helpers convert at the edges.
 */

/** Google Chirp3-HD locales GeminiService.textToSpeech can voice. */
export const GOOGLE_TTS_LOCALES: Record<string, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
};

/** Languages Sarvam's bulbul TTS models can voice. */
export const SARVAM_TTS_LANGUAGES = [
  'en',
  'hi',
  'bn',
  'gu',
  'kn',
  'ml',
  'mr',
  'od',
  'pa',
  'ta',
  'te',
] as const;

/** 'te-IN' → 'te'. Returns null for empty/unknown input. */
export function toShortLanguage(
  code: string | null | undefined,
): string | null {
  const value = (code ?? '').trim().toLowerCase();
  if (!value || value === 'unknown') return null;
  return value.split('-')[0] || null;
}

/** 'te' → 'te-IN', for Sarvam TTS. Unsupported languages fall back to en-IN. */
export function toSarvamTtsLanguage(
  language: string | null | undefined,
): string {
  const short = toShortLanguage(language) ?? 'en';
  return (SARVAM_TTS_LANGUAGES as readonly string[]).includes(short)
    ? `${short}-IN`
    : 'en-IN';
}

/** Languages the configured TTS can actually speak — the agent must not be
 * asked to reply in anything else. */
export function speakableLanguages(tts: TtsProviderName): ReadonlySet<string> {
  return tts === 'sarvam'
    ? new Set(SARVAM_TTS_LANGUAGES)
    : new Set(Object.keys(GOOGLE_TTS_LOCALES));
}
