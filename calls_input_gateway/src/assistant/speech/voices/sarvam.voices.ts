import type { VoiceCode } from './voice-codes';

/**
 * Sarvam bulbul:v3 speakers — multilingual, so one speaker per code covers
 * every call language. (bulbul:v4-flash uses per-language persona IDs
 * instead and would need its own table.)
 */
export const SARVAM_VOICES: Record<VoiceCode, string> = {
  female_1: 'roopa_hi_companion',
  male_1: 'anand_hi_documentary',
  female_2: 'aparna_en_edtech',
  male_2: 'shubh_hi_ecomm',
  female_3: 'shalini_enhi_companion',
  male_3: 'ashok_hi_news',
};
