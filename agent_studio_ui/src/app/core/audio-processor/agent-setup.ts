import { Agent } from '../models/agent.model';
import { AudioProcessorSetup } from './audio-processor.types';
import { DEFAULT_AGENT_VOICE } from '../../shared/constants/agent-voices.constant';

/**
 * Build the audio_processor `setup` payload for a Playground agent.
 * - `systemInstruction` carries the agent's behavior prompt.
 * - `phoneNumber` (E.164) routes to the matching business when the agent has a number
 *   assigned; otherwise it is omitted and the server falls back to its default business.
 */
export function buildAgentSetup(agent: Agent): AudioProcessorSetup {
  const setup: AudioProcessorSetup = {
    business: agent.base_template_id ?? '',
    agentId: agent.agent_id,
    greeting: agent.greeting ?? '',
    generationConfig: {
      speechConfig: {
        voiceConfig: {
          // The agent's voice code — the gateway maps it to the active TTS provider's voice.
          prebuiltVoiceConfig: { voiceName: agent.voice || DEFAULT_AGENT_VOICE },
        },
      },
    },
  };

  const prompt = agent.prompt?.trim();
  if (prompt) {
    setup.systemInstruction = { parts: [{ text: prompt }] };
  }

  const e164 = agentE164(agent);
  if (e164) {
    setup.phoneNumber = e164;
  }

  return setup;
}

function agentE164(agent: Agent): string | null {
  const code = agent.country_code?.trim();
  const number = agent.phone_number?.trim();
  if (!number) return null;
  // Some agents store the number already in E.164 — don't prefix it twice.
  if (number.startsWith('+')) return number;
  if (!code) return null;
  return `${code}${number}`;
}
