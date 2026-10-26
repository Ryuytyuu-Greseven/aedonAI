import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { routerLlm } from '../../../llms/google.llm.js';
import { applySignals, decayMood, initialMood, labelMood, MoodSignals } from '../mood/mood.engine.js';
import { loadPromptFile } from '../prompt/companion.prompts.js';
import { CompanionState } from '../state/companion.state.js';

const logger = new Logger('CompanionNodes');

/** The sentinel the gateway sends to start a call; its turn is the greeting. */
export const CONVERSATION_START = 'SYSTEM_START_CONVERSATION';

export const REPLY_NODES = [
  'Banter_Node',
  'Comfort_Node',
  'Curiosity_Node',
  'Shared_Memory_Node',
  'Plan_Node',
  'Goodbye_Node',
  'Care_Check_Node',
] as const;

export type ReplyNode = (typeof REPLY_NODES)[number];

const PerceptionSchema = z.object({
  route: z.enum(REPLY_NODES),
  userEmotion: z.enum(['happy', 'excited', 'neutral', 'tired', 'sad', 'stressed', 'angry', 'lonely']),
  flirtedOrComplimented: z.boolean().describe('Friend flirted with Madhu or complimented her.'),
  otherGirlName: z
    .string()
    .nullable()
    .describe('Name (or "a girl" if unnamed) of another girl your friend mentioned spending time or talking with. Null if none.'),
  dismissiveOrRude: z.boolean().describe('Friend brushed Madhu off, ignored her question, or was rude.'),
  apologized: z.boolean(),
  sharedSomething: z.boolean().describe('Friend shared news, a feeling, or something personal.'),
  distress: z
    .boolean()
    .describe(
      'ONLY true for genuine signs of self-harm, suicidal thoughts, being in danger, or a real crisis — NOT ordinary sadness, stress, or a bad day.',
    ),
});

export type Perception = z.infer<typeof PerceptionSchema>;

/** Code has the last word on safety, whatever route the LLM picked. */
export function chooseRoute(perception: Pick<Perception, 'route' | 'distress'>): ReplyNode {
  return perception.distress ? 'Care_Check_Node' : perception.route;
}

export function toSignals(perception: Perception): MoodSignals {
  return {
    userEmotion: perception.userEmotion,
    flirtedOrComplimented: perception.flirtedOrComplimented,
    otherGirlMentioned: perception.otherGirlName !== null,
    dismissiveOrRude: perception.dismissiveOrRude,
    apologized: perception.apologized,
    sharedSomething: perception.sharedSomething,
  };
}

async function perceive(state: CompanionState): Promise<Perception> {
  const perceiver = routerLlm.withStructuredOutput(PerceptionSchema, { name: 'perceive_turn' });
  const prompt = await loadPromptFile('perceive');
  // The last few turns are enough to read the moment; keeps this call fast.
  return perceiver.invoke([new SystemMessage(prompt), ...recentTurns(state.messages, 6)]);
}

/**
 * Every turn starts here: reads the user's latest turn (one structured LLM
 * call), moves her mood, and picks who replies. Madhu only knows this call —
 * nothing is loaded from or saved for earlier calls; her mood starts fresh
 * each call from the day's mood and the time of day.
 */
export async function Understand_Node(state: CompanionState) {
  const now = new Date();
  const lastMsg = state.messages[state.messages.length - 1];
  const text = typeof lastMsg?.content === 'string' ? lastMsg.content : '';

  const mood = decayMood(state.mood ?? initialMood(now), now);

  if (text === CONVERSATION_START) {
    logger.log(`[Understand] call start → Greeting_Node mood=${labelMood(mood)}`);
    return {
      mood,
      moodLabel: labelMood(mood),
      otherGirlName: null,
      routeDestination: 'Greeting_Node',
    };
  }

  const startedAt = Date.now();
  const perception = await perceive(state);
  const perceiveMs = Date.now() - startedAt;
  const moved = applySignals(mood, toSignals(perception));
  const route = chooseRoute(perception);

  logger.log(
    `[Understand] → ${route} emotion=${perception.userEmotion} mood=${labelMood(moved)} perceive=${perceiveMs}ms`,
  );
  return {
    mood: moved,
    moodLabel: labelMood(moved),
    otherGirlName: perception.otherGirlName,
    routeDestination: route,
  };
}

/** How the call-start sentinel is shown to the voice LLM. */
export function displayUserText(text: string): HumanMessage {
  return new HumanMessage(
    text === CONVERSATION_START ? '(The call just connected. You speak first.)' : text,
  );
}

/**
 * The last `limit` messages, trimmed forward to start on a user turn —
 * Gemini expects a conversation to open with the user, not the model.
 */
export function recentTurns(messages: BaseMessage[], limit: number): BaseMessage[] {
  const recent = messages.slice(-limit);
  const firstUser = recent.findIndex((message) => message instanceof HumanMessage);
  return firstUser === -1 ? recent : recent.slice(firstUser);
}
