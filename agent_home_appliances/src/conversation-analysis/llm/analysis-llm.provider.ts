import { ChatVertexAI } from '@langchain/google-vertexai';
import { config } from 'dotenv';

config();

// Deliberately a separate instance from src/agent/llms/google.llm.ts — this
// module must not import anything from src/agent/**. Same provider/env vars
// today since it's the same app, but no code-level coupling.
let instance: ChatVertexAI | null = null;

export function getAnalysisLlm(): ChatVertexAI {
  if (!instance) {
    instance = new ChatVertexAI({
      apiKey: process.env.GEMINI_API_KEY,
      modelName: 'gemini-3.1-flash-lite',
      temperature: 0.1,
      vertexai: true,
    });
  }
  return instance;
}
