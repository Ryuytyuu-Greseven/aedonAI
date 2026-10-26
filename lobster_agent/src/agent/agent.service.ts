import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { LlmUsageService } from '../common/llm-usage/index.js';
import { companionGraph } from './graphs/companion/graph/companion.graph.js';
import { IAgent } from '../common/interface/agent.interface.js';

interface AgentMessage {
  text: string;
  agentDetails: IAgent & { currentLanguage?: string };
  sessionId: string;
  threadId: string;
  customerId?: string;
  customerPhNo?: string;
}

/**
 * What a turn produces, in order: which node the router picked (logged in
 * the turn trace), then the reply text.
 */
export type AgentTurnEvent = { kind: 'route'; node: string } | { kind: 'text'; text: string };

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly llmUsage: LlmUsageService) {}

  public async *runAgent(msg: AgentMessage): AsyncGenerator<AgentTurnEvent> {
    this.logger.log(`[madhu] session="${msg.sessionId}" text="${msg.text.slice(0, 60)}"`);

    const tracker = this.llmUsage.createTracker({
      sessionId: msg.sessionId,
      threadId: msg.threadId,
      customerId: msg.customerId,
    });

    try {
      const result = await companionGraph.stream(
        {
          messages: [new HumanMessage(msg.text)],
          userQuery: msg.text,
          sessionId: msg.sessionId,
          customerId: msg.customerId ?? '',
          customerPhNo: msg.customerPhNo ?? '',
          agentDetails: msg.agentDetails ?? undefined,
        },
        { configurable: { thread_id: msg.threadId }, callbacks: [tracker] },
      );

      for await (const chunk of result) {
        const nodeState = Object.values(chunk)[0] as any;
        if (typeof nodeState?.routeDestination === 'string') {
          yield { kind: 'route', node: nodeState.routeDestination };
        }
        if (nodeState?.messages?.length > 0) {
          const token = nodeState.messages[nodeState.messages.length - 1];
          const text = typeof token?.text === 'string' ? token.text : (token?.content ?? '');
          if (text) yield { kind: 'text', text };
        }
      }
    } catch (err: any) {
      this.logger.error('companion agent error:', err);
      // Stay in character on the line; the real error is in the log above.
      yield { kind: 'text', text: 'అయ్యో, network సరిగ్గా లేదు అనుకుంటా... one more time చెప్పు?' };
    }
  }
}
