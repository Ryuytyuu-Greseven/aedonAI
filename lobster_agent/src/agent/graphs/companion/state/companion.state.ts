import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { IAgent } from '../../../../common/interface/agent.interface.js';
import { Mood, MoodLabel } from '../mood/mood.engine.js';

export type AgentDetails = IAgent & { currentLanguage?: string };

function reduceMessages(left: BaseMessage[] = [], right: BaseMessage[] | BaseMessage): BaseMessage[] {
  if (Array.isArray(right)) return left.concat(right);
  return left.concat([right]);
}

/** Survives turns that omit the value (same guard as the sales agents). */
function sticky<T>(fallback: () => T) {
  return Annotation<T>({
    reducer: (left, right) => right ?? left,
    default: fallback,
  });
}

/** Replaced every turn, including with null/[]. */
function perTurn<T>(fallback: () => T) {
  return Annotation<T>({
    reducer: (left, right) => (right !== undefined ? right : left),
    default: fallback,
  });
}

export const CompanionStateAnnotation = Annotation.Root({
  // This call's conversation — the only memory Madhu has (a thread_id is
  // one call; nothing carries over between calls).
  messages: Annotation<BaseMessage[]>({
    reducer: reduceMessages,
    default: () => [],
  }),
  userQuery: Annotation<string>(),
  sessionId: Annotation<string>(),
  customerId: Annotation<string>(),
  customerPhNo: Annotation<string>(),
  agentDetails: sticky<AgentDetails | null>(() => null),

  // Starts fresh each call (see Understand_Node), then moves turn by turn.
  mood: perTurn<Mood | null>(() => null),
  moodLabel: perTurn<MoodLabel>(() => 'calm'),

  /** Name of the girl the user just mentioned, if any — for her teasing. */
  otherGirlName: perTurn<string | null>(() => null),

  currentNode: sticky<string>(() => ''),
  routeDestination: sticky<string>(() => 'Greeting_Node'),
});

export type CompanionState = typeof CompanionStateAnnotation.State;
