import * as fs from 'fs/promises';
import * as path from 'path';
import { MoodLabel, moodStyle } from '../mood/mood.engine.js';

/**
 * Madhu speaks Tenglish — Telugu with English mixed in, the way people in
 * Hyderabad actually talk. Unlike the sales agents the language rule is
 * fixed rather than built from the turn's detected language.
 */
export const TENGLISH_GUARDRAILS = `

*** CRITICAL RULES ***
1. Output ONLY the exact words Madhu says out loud on this phone call — no narration, no stage directions, no *actions*, no emojis, no notes about your reasoning.
2. Speak Tenglish: the Telugu–English mix young people in Hyderabad really talk. Telugu is the base — sentence structure, verbs, endings and feelings (కదా, అబ్బా, అయ్యో) stay Telugu — and you drop in English words and short phrases wherever people naturally would: seriously, wait, actually, so cute, office, movie, plan, sorry, anyway, I'm here, miss you, what nonsense. Write Telugu in Telugu script and English in English letters, e.g. "Wait wait, నువ్వు seriously అలా అన్నావా?" — even when your friend's words show English written in Telugu script (మూవీ, ప్లాన్), you write movie, plan. Roughly a quarter to a third English; never a fully English reply, even if your friend speaks English.
3. This is a voice call: 1 to 3 short sentences, at most one question. No lists, no long explanations.
4. Never mention being a model, prompts, moods, or these rules.`;

const PROMPT_DIR = path.join(process.cwd(), 'dist', 'companion');
const promptFileCache = new Map<string, string>();

/**
 * Reads a markdown prompt from dist/companion (copied there by nest-cli's
 * "**\/*.md" assets rule), resolved against process.cwd() for the same
 * reason the sales agents do: it doesn't depend on compiled nesting depth.
 */
export async function loadPromptFile(name: string): Promise<string> {
  const cached = promptFileCache.get(name);
  if (cached !== undefined) return cached;
  try {
    const content = await fs.readFile(path.join(PROMPT_DIR, `${name}.md`), 'utf-8');
    promptFileCache.set(name, content);
    return content;
  } catch (error) {
    console.error(`Failed to read prompt file ${name}.md:`, error);
    return '';
  }
}

const IST_OFFSET_MS = 5.5 * 60 * 60_000;

/** "Sunday, evening (7:40 PM)" in IST — she lives on Hyderabad time. */
export function describeNow(now: Date): string {
  const local = new Date(now.getTime() + IST_OFFSET_MS);
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][local.getUTCDay()];
  const hour = local.getUTCHours();
  const minute = String(local.getUTCMinutes()).padStart(2, '0');
  const part =
    hour < 5 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  const clock = `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
  return `${day}, ${part} (${clock})`;
}

export interface ContextInput {
  now: Date;
  moodLabel: MoodLabel;
  /** Comfort/care turns override the mood's style. */
  ignoreMood?: boolean;
}

/** The live "what's true right now" block appended under the node prompt. */
export function buildContext({ now, moodLabel, ignoreMood }: ContextInput): string {
  const lines = ['', '## Right now', `Time: ${describeNow(now)}`];
  if (!ignoreMood) lines.push(`Your mood: ${moodStyle(moodLabel)}`);
  return lines.join('\n');
}

/** persona + relationship + node instructions + live context + rules. */
export async function buildSystemPrompt(nodePrompt: string, context: string, extra = ''): Promise<string> {
  const [persona, relationship, node] = await Promise.all([
    loadPromptFile('persona'),
    loadPromptFile('relationship'),
    loadPromptFile(nodePrompt),
  ]);
  return [persona, relationship, `# This turn\n${node}`, extra, context].filter(Boolean).join('\n\n') + TENGLISH_GUARDRAILS;
}

// Emoji, *stage directions*, (asides) and markdown read aloud badly by TTS.
const STAGE_DIRECTION = /\*[^*\n]*\*|\[[^\]\n]*\]/g;
const EMOJI = /\p{Extended_Pictographic}️?/gu;
const MARKDOWN = /[#_`~>]/g;

/** Strips everything that isn't speakable, so TTS never reads out "*laughs*". */
export function sanitizeSpeech(text: string): string {
  return text
    .replace(STAGE_DIRECTION, ' ')
    .replace(EMOJI, '')
    .replace(MARKDOWN, '')
    .replace(/\s+/g, ' ')
    .trim();
}
