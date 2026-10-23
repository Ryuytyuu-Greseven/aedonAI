import type { VoiceCode } from './voice-codes';

/**
 * Google Cloud Chirp3-HD voice names. They're shared across locales —
 * GeminiService builds `<locale>-Chirp3-HD-<name>` from the call language.
 * female_1 keeps Aoede, the voice every agent used before voices existed.
 */
export const GOOGLE_VOICES: Record<VoiceCode, string> = {
  female_1: 'Aoede',
  male_1: 'Charon',
  female_2: 'Kore',
  male_2: 'Puck',
  female_3: 'Leda',
  male_3: 'Fenrir',
};
