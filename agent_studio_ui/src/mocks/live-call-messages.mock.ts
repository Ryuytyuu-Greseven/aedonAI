import { ActiveSession, LiveMessage } from '../app/core/models/active-session.model';
import { hashSeed, mulberry32, pick } from './call-records.mock';

const AGENT_LINES = [
  "Thanks for calling — how can I help you today?",
  'Let me pull up your account, one moment.',
  'I can see your details here — checking the latest status now.',
  "That's a great question, let me look into that for you.",
  "I've found a couple of options, would you like me to walk through them?",
  "I've gone ahead and updated that for you.",
  'Is there anything else I can help you with today?',
  "You're all set — I've noted everything on the account.",
] as const;

const CUSTOMER_LINES = [
  'Hi, I wanted to ask about my recent order.',
  "I'm having trouble with my last billing statement.",
  'Could you help me reschedule an appointment?',
  'Yes, that sounds right, please go ahead.',
  'No, that covers it, thank you.',
  'Could you also update my contact number?',
  'How long will that take to process?',
  'Perfect, thanks for your help.',
] as const;

// Average gap between messages, jittered per message so the pace feels natural
// rather than metronomic.
const AVG_MESSAGE_GAP_MS = 9000;
const FIRST_MESSAGE_DELAY_MS = 2000;

/**
 * Mock-only generator standing in for a real live-transcript feed. Recomputes
 * the full message list from scratch each call (deterministic per session id),
 * so the list simply grows as `atMs` advances past more message thresholds —
 * no persisted/stateful buffer needed, mirroring how call detail's timeline is
 * generated on demand.
 */
export function generateLiveMessages(session: ActiveSession, atMs: number = Date.now()): LiveMessage[] {
  const startMs = new Date(session.startedAt).getTime();
  const elapsedMs = Math.max(0, atMs - startMs);
  const rng = mulberry32(hashSeed(session.id));

  const messages: LiveMessage[] = [];
  let cursor = FIRST_MESSAGE_DELAY_MS + Math.floor(rng() * 2000);
  let index = 0;

  while (cursor <= elapsedMs) {
    const speaker: LiveMessage['speaker'] = index % 2 === 0 ? 'agent' : 'customer';
    const pool = speaker === 'agent' ? AGENT_LINES : CUSTOMER_LINES;
    messages.push({
      id: `${session.id}-m${index}`,
      speaker,
      text: pick(rng, pool),
      at: new Date(startMs + cursor).toISOString(),
    });
    index++;
    cursor += Math.round(AVG_MESSAGE_GAP_MS * (0.6 + rng() * 0.8));
  }

  return messages;
}
