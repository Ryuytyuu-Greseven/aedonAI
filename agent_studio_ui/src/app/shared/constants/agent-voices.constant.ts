export type AgentVoiceGender = 'female' | 'male';

export interface AgentVoice {
  /** Provider-neutral code saved on the agent; the gateway maps it per TTS provider. */
  code: string;
  /** Display name — UI only, safe to rename. */
  name: string;
  gender: AgentVoiceGender;
}

/**
 * Voices an agent can speak with. Codes are persisted — never rename one.
 * Keep codes in sync with agent_studio_server `agents/agent-voices.ts` and
 * calls_input_gateway `assistant/speech/voices/voice-codes.ts`.
 */
export const AGENT_VOICES: AgentVoice[] = [
  { code: 'female_1', name: 'Madhu', gender: 'female' },
  { code: 'male_1', name: 'Govind', gender: 'male' },
  { code: 'female_2', name: 'Prerana', gender: 'female' },
  { code: 'male_2', name: 'Vikram', gender: 'male' },
  { code: 'female_3', name: 'Sandhya', gender: 'female' },
  { code: 'male_3', name: 'Uday', gender: 'male' },
];

/** Voice for agents saved before voices existed — matches the gateway default. */
export const DEFAULT_AGENT_VOICE = 'female_1';
