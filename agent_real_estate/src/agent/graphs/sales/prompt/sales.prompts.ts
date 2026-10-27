import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Builds the global guardrails block, including the language directive for
 * this turn. Kept as a function (not a cached constant) because
 * `currentLanguage` is per-request/per-session — customers can switch
 * languages mid-conversation, and this process may be serving multiple
 * concurrent sessions in different languages at once, so it must never be
 * baked into the promptFileCache below (that cache is keyed only by prompt
 * name and shared across all sessions).
 */
export function buildGlobalGuardrails(currentLanguage?: string): string {
  const isEnglish = currentLanguage?.trim().toLowerCase().startsWith('en');
  const languageRule = currentLanguage
    ? `5. LANGUAGE: Respond ONLY in ${currentLanguage}. Every sentence of your spoken response must be entirely in ${currentLanguage}${isEnglish ? '' : ' — do not mix in English or any other language'}. The customer's language can change between turns; always match the language given here for THIS turn, regardless of what language earlier turns used.`
    : `5. LANGUAGE: Respond in the same language the customer is currently speaking in.`;

  return `

*** CRITICAL GLOBAL VOICE GUARDRAILS ***
1. ONLY output the exact spoken words you want the customer to hear over the phone. Never include internal reasoning, notes, self-corrections, or asterisks (like *Self-Correction:*).
2. NEVER output markdown syntax, bullet points, headers, numbered lists, quotation marks, emojis, or technical function names.
3. SPOKEN NUMBERS & UNITS: Always pronounce figures conversationally in Indian currency/realty units: say "75 lakhs", "1.25 crore", "two BHK", "1800 square feet". Never output raw unformatted digits like "7500000".
4. VOICE CADENCE: Keep sentences short (10–18 words maximum per breath) and responses concise (under 70 words total).
5. THREE-STEP FLOW: In every turn: (a) briefly acknowledge what the customer said ("Understood", "That makes sense", "Great choice"), (b) answer directly or share the highlight, and (c) steer forward with ONE clear, low-pressure question.
6. Never break character. You are speaking live on a telephone call.
${languageRule}`;
}

// In-memory heap cache for raw prompt file contents only (no guardrails —
// those are language-dependent and rebuilt fresh on every call, see above).
const promptFileCache = new Map<string, string>();

/**
 * Builds the runtime "who am I" context appended to every node's system
 * prompt. `agentName` comes from IAgent.agent_name over the socket;
 * `systemInstruction` remains the free-text carrier for company identity
 * (IAgent has no company-name field, only a companyId).
 */
export function identityContext(state: { agentName?: string; systemInstruction?: string }): string {
  const parts: string[] = [];
  if (state.agentName) parts.push(`Your name: ${state.agentName}`);
  if (state.systemInstruction) parts.push(state.systemInstruction);
  return parts.length ? `\n\nAgent Identity:\n${parts.join('\n')}` : '';
}

/**
 * Reads a markdown prompt from disk (or cache) and appends the global
 * guardrails — including the LANGUAGE rule for `currentLanguage` — fresh on
 * every call. Only the raw file content is cached; the guardrails block is
 * never cached since it depends on this request's language.
 */
export async function getPrompt(promptName: string, currentLanguage?: string): Promise<string> {
  let content = promptFileCache.get(promptName);

  if (content === undefined) {
    try {
      // Resolved against process.cwd() (always the app root — /app in the
      // Docker image's WORKDIR, the repo root in local dev) rather than a
      // __dirname-relative "../../.." chain: that chain's required '..'
      // count is tied to this compiled file's exact nesting depth under
      // dist/, which has already silently broken once when rootDir changed
      // the compiled output's directory depth.
      const filePath = path.join(process.cwd(), 'dist', 'sales', `${promptName}.md`);
      content = await fs.readFile(filePath, 'utf-8');
      promptFileCache.set(promptName, content);
    } catch (error) {
      console.error(`Failed to read prompt file ${promptName}.md:`, error);
      return `ERROR: Missing prompt ${promptName}.md`;
    }
  }

  return content + buildGlobalGuardrails(currentLanguage);
}
