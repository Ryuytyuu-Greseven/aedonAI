import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { LlmUsageService } from '../common/llm-usage/index.js';
import { salesGraph } from './graphs/sales/graph/sales.graph.js';
import { IAgent } from '../common/interface/agent.interface.js';
import { warmUpKnowledgeBaseRetrieval } from './graphs/sales/tool/knowledge-base.store.js';

interface AgentMessage {
  text: string;
  // `currentLanguage` is not part of the persisted IAgent entity — it's a
  // per-turn addition the upstream audio pipeline attaches to describe the
  // language detected for THIS utterance, separate from `language` (the
  // agent's configured/default language).
  agentDetails: IAgent & { currentLanguage?: string };
  sessionId: string;
  threadId: string;
  systemInstruction?: string;
  business?: string;
  customerId?: string;
  customerPhNo?: string;
  callId?: string;
  channel?: 'live' | 'preview';
}

/**
 * What a turn produces, in order: which node the router picked (so the
 * gateway can play a filler while a slow node runs), the reply text,
 * and optionally an end_call event when the conversation is gracefully terminated.
 */
export type AgentTurnEvent =
  | { kind: 'route'; node: string }
  | { kind: 'text'; text: string }
  | { kind: 'end_call' };

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly llmUsage: LlmUsageService) { }

  onModuleInit(): void {
    // Fire-and-forget: never delays startup, never throws.
    void warmUpKnowledgeBaseRetrieval();
  }

  public async *runAgent(msg: AgentMessage): AsyncGenerator<AgentTurnEvent> {
    this.logger.log(`[sales] session="${msg.sessionId}" text="${msg.text.slice(0, 60)}"`);

    const tracker = this.llmUsage.createTracker({
      sessionId: msg.sessionId,
      threadId: msg.threadId,
      customerId: msg.customerId,
    });

    try {
      console.log('Query from User: \t', msg.text, 'Agent Details:\n', msg.agentDetails);
      const result = await salesGraph.stream(
        {
          messages: [new HumanMessage(msg.text)],
          userQuery: msg.text,
          systemInstruction: msg.systemInstruction ?? '',
          business: msg.business ?? 'sales',
          sessionId: msg.sessionId,
          customerId: msg.customerId ?? '',
          customerPhNo: msg.customerPhNo ?? '',
          callId: msg.callId,
          channel: msg.channel,
          // Passed through as-is (no `?? ''` coercion here) — SalesState's
          // `right ?? left` reducers on these channels are what preserve the
          // previously known value across the session when a turn's
          // agentDetails is missing a field; pre-coercing a missing value to
          // '' would defeat that guard ('' ?? left still evaluates to '').
          agentDetails: msg.agentDetails ?? undefined,
          currentLanguage: msg.agentDetails?.currentLanguage || msg.agentDetails?.language,
          agentPreferedLanguage: msg.agentDetails?.language,
          agentName: msg.agentDetails?.agent_name,
        },
        { configurable: { thread_id: msg.threadId }, callbacks: [tracker] },
      );

      let callTerminationTriggered = false;

      for await (const chunk of result) {
        const nodeState = Object.values(chunk)[0] as any;
        if (typeof nodeState?.routeDestination === 'string') {
          yield { kind: 'route', node: nodeState.routeDestination };
        }
        if (nodeState?.endCall === true || nodeState?.currentNode === 'Graceful_Rejection_Node') {
          callTerminationTriggered = true;
        }
        if (nodeState?.messages?.length > 0) {
          const token = nodeState.messages[nodeState.messages.length - 1];
          const text = typeof token?.text === 'string' ? token.text : (token?.content ?? '');
          if (text) yield { kind: 'text', text };
        }
      }

      if (callTerminationTriggered) {
        yield { kind: 'end_call' };
      }
    } catch (err: any) {
      this.logger.error('sales agent error:', err);
      yield { kind: 'text', text: `I encountered an error: ${err.message ?? err}` };
    }
  }
}
