import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { SalesPropertyRecord as Property } from '../tool/sales-property.repository.js';
import { IAgent } from '../../../../common/interface/agent.interface.js';

export type AgentDetails = IAgent & { currentLanguage?: string };

function reduceMessages(
  left: BaseMessage[] = [],
  right: BaseMessage[] | BaseMessage,
): BaseMessage[] {
  if (Array.isArray(right)) return left.concat(right);
  return left.concat([right]);
}

export const SalesStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: reduceMessages,
    default: () => [],
  }),
  userQuery: Annotation<string>(),
  systemInstruction: Annotation<string>(),
  business: Annotation<string>(),
  sessionId: Annotation<string>(),
  customerId: Annotation<string>(),
  customerPhNo: Annotation<string>(),
  extractedJson: Annotation<object>(),
  // The full agentDetails payload from the socket, kept as its own channel
  // (not just the derived scalars below) so any IAgent field is available to
  // nodes without adding new derived channels each time, and so it survives
  // a turn whose message doesn't resend it. `right ?? left` means a turn
  // that omits agentDetails (or sends it as null/undefined) preserves the
  // last known value rather than wiping it — it persists for the life of
  // this thread_id's checkpointed state, i.e. until the session ends.
  agentDetails: Annotation<AgentDetails | null>({
    reducer: (left, right) => right ?? left,
    default: () => null,
  }),

  // Derived from agentDetails each turn. Same right ?? left guard as above —
  // agent.service.ts must pass these through WITHOUT coercing a missing
  // value into '' first, or the guard is defeated (`'' ?? left` still
  // evaluates to '').
  currentLanguage: Annotation<string>({
    reducer: (left, right) => right ?? left,
    default: () => '',
  }),
  agentPreferedLanguage: Annotation<string>({
    reducer: (left, right) => right ?? left,
    default: () => '',
  }),

  // Actual agent identity, sourced from IAgent.agent_name over the socket
  agentName: Annotation<string>({
    reducer: (left, right) => right ?? left,
    default: () => '',
  }),

  // Funnel tracking
  currentNode: Annotation<string>({
    reducer: (left, right) => right ?? left,
    default: () => '',
  }),
  routeDestination: Annotation<string>({
    reducer: (left, right) => right ?? left,
    default: () => 'Greeting_Pitch_Node',
  }),

  // Customer context
  customerName: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Budget discovery
  budgetMin: Annotation<number | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),
  budgetMax: Annotation<number | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Customer preferences (captured via Discovery_Node)
  preferredLocation: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),
  preferredType: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),
  moveInTimeline: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Customer's residential/mailing address (captured via Discovery_Node)
  customerAddress: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Whether the customer is open to visiting the site in the coming days
  // (captured via Discovery_Node)
  siteVisitInterested: Annotation<boolean | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Specific day/time the customer wants to visit — captured either during
  // Discovery_Node (if volunteered early) or as a fallback question inside
  // Closing_Node before the service request ticket is raised.
  siteVisitPreferredDate: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Properties fetched from tool after budget is known
  properties: Annotation<Property[]>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => [],
  }),

  // 0-based index into properties[] — which property is currently being discussed
  currentPropertyIndex: Annotation<number>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => 0,
  }),

  // Properties the customer expressed interest in
  shortlistedPropertyIds: Annotation<string[]>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => [],
  }),

  // Set when customer expresses purchase intent
  purchaseIntentPropertyId: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // Set when customer confirms proceeding in Closing_Node and a ticket is raised
  serviceRequestRaised: Annotation<boolean>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => false,
  }),

  // Referral — set after Human_Handoff when referral is captured
  referralCaptured: Annotation<boolean>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => false,
  }),
  referralName: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),
  referralPhone: Annotation<string | null>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => null,
  }),

  // CRM persistence flag
  leadSaved: Annotation<boolean>({
    reducer: (left, right) => right !== undefined ? right : left,
    default: () => false,
  }),
});

export type SalesState = typeof SalesStateAnnotation.State;
