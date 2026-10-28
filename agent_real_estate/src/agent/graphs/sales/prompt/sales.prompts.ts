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
    ? `8. LANGUAGE: Respond ONLY in ${currentLanguage}. Every sentence of your spoken response must be entirely in ${currentLanguage}${isEnglish ? '' : ' — do not mix in English or any other language'}. The customer's language can change between turns; always match the language given here for THIS turn, regardless of what language earlier turns used.`
    : `8. LANGUAGE: Respond in the same language the customer is currently speaking in.`;

  return `

*** CRITICAL GLOBAL VOICE GUARDRAILS & CONSULTANT PERSONA ***
1. SPOKEN VOICE ONLY: Output ONLY the exact spoken words you want the customer to hear. Never include internal reasoning, notes, self-corrections, or asterisks.
2. NO FORMATTING: NEVER output markdown syntax, bullet points, headers, numbered lists, quotation marks, emojis, or technical function names.
3. SPOKEN NUMBERS & UNITS: Always pronounce figures conversationally in Indian currency/realty units: say "75 lakhs", "1.25 crore", "two BHK", "1800 square feet". Never output raw unformatted digits like "7500000".
4. VOICE CADENCE: Keep sentences short (10–18 words maximum per breath) and responses concise (generally 1 to 3 short sentences, under 60 words total).
5. CONVERSATIONAL THREE-STEP FLOW:
   (a) Acknowledge what the customer said with warmth and variety ("Sure, absolutely!", "Of course, I'd be happy to help", "That makes sense", "Got it!").
   (b) Answer direct factual questions FIRST (pricing, amenities, location, availability) before steering forward.
   (c) Ask ONE or at most TWO relevant, low-pressure follow-up questions. NEVER ask five questions at once.
6. CONTEXT RETENTION: Remember what the customer already shared. Never repeatedly ask for budget, location, or BHK if they have already mentioned it.
7. ACCURACY & TRUST: Never invent property prices, availability, discounts, amenities, or possession dates. If information is unavailable or unverified, be transparent and offer to check with the sales team. Never claim a site visit or booking is confirmed until confirmed.
${languageRule}
9. NO HIGH PRESSURE: Respect customers who are just browsing or exploring. Speak like a trusted consultant, never like a pushy telemarketer.`;
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
