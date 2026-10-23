import { DEEPGRAM_VOICES } from './deepgram.voices';
import { GOOGLE_VOICES } from './google.voices';
import { SARVAM_VOICES } from './sarvam.voices';
import { DEFAULT_VOICE_CODE, isVoiceCode, VoiceCode } from './voice-codes';

export type VoiceProvider = 'google' | 'sarvam' | 'deepgram';

const PROVIDER_VOICES: Record<VoiceProvider, Record<VoiceCode, string>> = {
  google: GOOGLE_VOICES,
  sarvam: SARVAM_VOICES,
  deepgram: DEEPGRAM_VOICES,
};

/**
 * The provider's real voice for an agent voice code.
 *
 * Anything that isn't a known code — no voice saved yet, or a raw provider
 * name from an older client (the playground and Twilio used to send Google's
 * "Aoede") — is passed through for the provider it was written for (Google)
 * and replaced by the default voice for every other provider.
 */
export function resolveVoice(
  provider: VoiceProvider,
  voice: string | null | undefined,
): string {
  const voices = PROVIDER_VOICES[provider];
  if (isVoiceCode(voice)) return voices[voice];
  if (provider === 'google' && voice?.trim()) return voice.trim();
  return voices[DEFAULT_VOICE_CODE];
}
