import { ChatVertexAI } from '@langchain/google-vertexai';
import { config } from 'dotenv';

config();

const MODEL = process.env.LOBSTER_LLM_MODEL ?? 'gemini-3.1-flash-lite';

/** Structured, deterministic calls: reading the user's turn and routing. */
export const routerLlm = new ChatVertexAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: MODEL,
  temperature: 0.1,
  thinkingLevel: 'LOW',
  reasoningLevel: 'low',
  vertexai: true,
});

/**
 * Madhu's own voice. Warm enough to sound spontaneous and not repeat
 * herself; still low-thinking because every millisecond is dead air on a call.
 */
export const voiceLlm = new ChatVertexAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: process.env.LOBSTER_VOICE_MODEL ?? MODEL,
  temperature: Number(process.env.LOBSTER_VOICE_TEMPERATURE ?? 0.85),
  thinkingLevel: 'LOW',
  reasoningLevel: 'low',
  vertexai: true,
});
