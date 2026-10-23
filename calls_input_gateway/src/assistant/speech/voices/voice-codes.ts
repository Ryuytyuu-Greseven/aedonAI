/**
 * Provider-neutral agent voices. The Studio stores one of these codes on the
 * agent (`agents.voice`) and shows its own display name for it (Madhu,
 * Govind, …); each TTS provider maps the code to one of its real voices in
 * ./<provider>.voices.ts. Codes are persisted — never rename one; add new
 * codes instead and map them in every provider file.
 *
 * Keep in sync with agent_studio_ui `shared/constants/agent-voices.constant.ts`
 * and agent_studio_server `agents/agent-voices.ts`.
 */
export const VOICE_CODES = [
  'female_1', // Madhu
  'male_1', // Govind
  'female_2', // Prerana
  'male_2', // Vikram
  'female_3', // Sandhya
  'male_3', // Uday
] as const;

export type VoiceCode = (typeof VOICE_CODES)[number];

/** Used when an agent has no voice saved (agents created before voices). */
export const DEFAULT_VOICE_CODE: VoiceCode = 'female_1';

export function isVoiceCode(value: unknown): value is VoiceCode {
  return (
    typeof value === 'string' &&
    (VOICE_CODES as readonly string[]).includes(value)
  );
}
