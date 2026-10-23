import type { VoiceCode } from './voice-codes';

/**
 * Deepgram Aura-2 voice models. Mapped ahead of time so the codes stay the
 * same if Deepgram TTS is added — the gateway uses Deepgram for STT only
 * today, so nothing reads this yet.
 */
export const DEEPGRAM_VOICES: Record<VoiceCode, string> = {
  female_1: 'aura-2-thalia-en',
  male_1: 'aura-2-apollo-en',
  female_2: 'aura-2-andromeda-en',
  male_2: 'aura-2-arcas-en',
  female_3: 'aura-2-helena-en',
  male_3: 'aura-2-zeus-en',
};
