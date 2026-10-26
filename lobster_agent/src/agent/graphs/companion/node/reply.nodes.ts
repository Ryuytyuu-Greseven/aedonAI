import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { voiceLlm } from '../../../llms/google.llm.js';
import { buildContext, buildSystemPrompt, sanitizeSpeech } from '../prompt/companion.prompts.js';
import { CompanionState } from '../state/companion.state.js';
import { displayUserText, recentTurns } from './understand.node.js';

// Enough of this call for her to stay coherent; it's all she remembers.
const HISTORY_TURNS = 20;

function history(messages: BaseMessage[]): BaseMessage[] {
  return recentTurns(messages, HISTORY_TURNS).map((message) =>
    message instanceof HumanMessage && typeof message.content === 'string'
      ? displayUserText(message.content)
      : message,
  );
}

interface SpeakOptions {
  /** Extra instructions for this turn, below the node prompt. */
  extra?: string;
  /** Comfort/care replies don't take on her mood of the moment. */
  ignoreMood?: boolean;
}

/** Shared by every reply node: one voice-LLM call in Madhu's persona. */
async function speak(state: CompanionState, node: string, promptName: string, opts: SpeakOptions = {}) {
  const context = buildContext({
    now: new Date(),
    moodLabel: state.moodLabel,
    ignoreMood: opts.ignoreMood,
  });
  const system = await buildSystemPrompt(promptName, context, opts.extra);
  const result = await voiceLlm.invoke([new SystemMessage(system), ...history(state.messages)]);
  const raw = typeof result.content === 'string' ? result.content : result.text;
  const reply = sanitizeSpeech(raw ?? '') || 'హ్మ్... చెప్పు, I\'m listening.';
  return { messages: [new AIMessage(reply)], currentNode: node };
}

export const Greeting_Node = (state: CompanionState) => speak(state, 'Greeting_Node', 'greeting');

export const Banter_Node = (state: CompanionState) =>
  speak(state, 'Banter_Node', 'banter', {
    extra: state.otherGirlName
      ? `Your friend just mentioned another girl: ${state.otherGirlName}. Notice it.`
      : undefined,
  });

export const Comfort_Node = (state: CompanionState) =>
  speak(state, 'Comfort_Node', 'comfort', { ignoreMood: true });

export const Curiosity_Node = (state: CompanionState) => speak(state, 'Curiosity_Node', 'curiosity');

export const Shared_Memory_Node = (state: CompanionState) =>
  speak(state, 'Shared_Memory_Node', 'shared_memory');

export const Plan_Node = (state: CompanionState) => speak(state, 'Plan_Node', 'plan');

export const Goodbye_Node = (state: CompanionState) => speak(state, 'Goodbye_Node', 'goodbye');

export const Care_Check_Node = (state: CompanionState) =>
  speak(state, 'Care_Check_Node', 'care_check', { ignoreMood: true });
