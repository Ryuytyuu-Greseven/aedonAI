import { FORCED_BUSINESS } from './business-agents.registry';

/**
 * When set, every call runs in this language from the first second: STT is
 * locked/biased to it, and per-utterance language detection never moves the
 * session (or the TTS voice, or the agent's reply language) off it.
 *
 * Defaults to Telugu while every call is forced to lobster_agent (Madhu
 * speaks Telugu only). PINNED_LANGUAGE=<code> sets another one, and
 * PINNED_LANGUAGE= (empty) turns pinning off.
 */
export const PINNED_LANGUAGE: string | null =
  (
    process.env.PINNED_LANGUAGE ??
    (FORCED_BUSINESS === 'lobster_agent' ? 'te' : '')
  )
    .trim()
    .toLowerCase()
    .split('-')[0] || null;
