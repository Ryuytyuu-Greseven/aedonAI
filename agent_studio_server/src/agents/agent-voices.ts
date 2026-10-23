/**
 * Provider-neutral voice codes an agent can be saved with. Display names live
 * in the Studio; calls_input_gateway maps each code to a real voice per TTS
 * provider. Codes are persisted — never rename one.
 *
 * Keep in sync with calls_input_gateway `assistant/speech/voices/voice-codes.ts`
 * and agent_studio_ui `shared/constants/agent-voices.constant.ts`.
 */
export const AGENT_VOICE_CODES = [
  'female_1',
  'male_1',
  'female_2',
  'male_2',
  'female_3',
  'male_3',
] as const;

export type AgentVoiceCode = (typeof AGENT_VOICE_CODES)[number];
