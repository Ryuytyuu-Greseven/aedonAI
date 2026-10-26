import WebSocket from 'ws';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { ConversationAnalysisQueueService } from '../conversation-analysis/index.js';
import {
  CONVERSATION_START,
  FillerController,
  resolveFillerLanguage,
} from './graphs/sales/filler/filler-controller.js';
import { LiveSession, recordCustomerTurn, syncSessionDetails } from './gateway.helpers.js';

@WebSocketGateway({ path: '/agent', cors: true })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentGateway.name);
  // One WS connection = one call, per the audio_processor's own
  // connect/disconnect-per-call lifecycle (see handleConnection/handleDisconnect logs).
  private readonly sessions = new WeakMap<WebSocket, LiveSession>();

  @WebSocketServer()
  private readonly server?: WebSocket.Server;

  // Exposed for the health endpoint; WeakMap can't be counted.
  get activeConnections(): number {
    return this.server?.clients.size ?? 0;
  }

  constructor(
    private readonly agentService: AgentService,
    private readonly conversationAnalysisQueue: ConversationAnalysisQueueService,
  ) {}

  handleConnection(client: WebSocket): void {
    this.logger.log('audio_processor connected');
    this.sessions.set(client, {
      conversationId: null,
      agentId: null,
      companyId: null,
      customerId: null,
      customerPhone: null,
      callId: null,
      channel: null,
      transcript: [],
      fillerMemory: { lastPhrase: null },
    });

    client.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type !== 'message') return;

        const session = this.sessions.get(client);
        if (session) {
          syncSessionDetails(session, msg);
          recordCustomerTurn(session, msg.text);
        }

        // Fillers ("Let me check that for you.") cover the silence while a
        // slow turn is prepared. They go out as their own message type and
        // never enter the transcript or the graph's history.
        const turnStartedAt = Date.now();
        const fillers = new FillerController({
          send: (text) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'filler', text }));
            }
          },
          language: resolveFillerLanguage(msg.agentDetails?.currentLanguage, msg.agentDetails?.language),
          memory: session?.fillerMemory ?? { lastPhrase: null },
          isConversationStart: msg.text === CONVERSATION_START,
        });
        let routedNode: string | null = null;
        let routedAtMs: number | null = null;
        let firstReplyAtMs: number | null = null;
        fillers.start();

        try {
          for await (const event of this.agentService.runAgent(msg)) {
            if (event.kind === 'route') {
              routedNode ??= event.node;
              routedAtMs ??= Date.now() - turnStartedAt;
              fillers.onRoute(event.node);
              continue;
            }
            fillers.onReply();
            firstReplyAtMs ??= Date.now() - turnStartedAt;
            session?.transcript.push({ speaker: 'agent', text: event.text, timestamp: new Date() });
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'token', text: event.text }));
            }
          }
        } finally {
          fillers.dispose();
          const sentFillers = fillers.sent.map((f) => `${f.kind}@${f.atMs}ms`).join(',') || 'none';
          this.logger.log(
            `[turn] session=${msg.sessionId} node=${routedNode ?? '-'} router=${routedAtMs ?? '-'}ms ` +
              `filler=${sentFillers} first_reply=${firstReplyAtMs ?? '-'}ms total=${Date.now() - turnStartedAt}ms`,
          );
        }

        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'done' }));
        }
      } catch (err: any) {
        this.logger.error('Agent error:', err.message);
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      }
    });

    client.on('error', (err) => this.logger.error('Client socket error:', err.message));
  }

  handleDisconnect(client: WebSocket): void {
    this.logger.log('audio_processor disconnected');

    const session = this.sessions.get(client);
    this.sessions.delete(client);

    // The only touchpoint into the conversation-analysis module: hand off
    // the conversation id + transcript this connection accumulated, and
    // forget about it — everything from here (queueing, analysis, storage)
    // is that module's own concern.
    if (session?.conversationId && session.transcript.length > 0) {
      this.conversationAnalysisQueue
        .enqueue({
          conversationId: session.conversationId,
          transcript: session.transcript,
          agentId: session.agentId,
          companyId: session.companyId,
          customerId: session.customerId,
          customerPhone: session.customerPhone,
          callId: session.callId,
          channel: session.channel,
        })
        .catch((err) => this.logger.error('Failed to enqueue conversation for analysis:', err));
    }
  }
}
