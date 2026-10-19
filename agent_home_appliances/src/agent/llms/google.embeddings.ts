import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { config } from 'dotenv'

config();

// text-multilingual-embedding-002 (768 dims) over the English-only model
// since customers/agents may query in Hindi/regional languages
// (state already tracks currentLanguage / agentPreferedLanguage).
const generateInstance = () => {
  return new VertexAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'text-multilingual-embedding-002',
  });
}

export const embeddingsInstance: VertexAIEmbeddings = generateInstance();
