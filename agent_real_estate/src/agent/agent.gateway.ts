import WebSocket from 'ws';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { ConversationAnalysisQueueService, ConversationTurn } from '../conversation-analysis/index.js';

interface LiveSession {
  conversationId: string | null;
  agentId: string | null;
  companyId: string | null;
  customerId: string | null;
  customerPhone: string | null;
  callId: string | null;
  channel: 'live' | 'preview' | null;
  transcript: ConversationTurn[];
}

@WebSocketGateway({ path: '/agent', cors: true })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentGateway.name);
  // One WS connection = one call, per the audio_processor's own
  // connect/disconnect-per-call lifecycle (see handleConnection/handleDisconnect logs).
  private readonly sessions = new WeakMap<WebSocket, LiveSession>();

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
    });

    client.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type !== 'message') return;

        const session = this.sessions.get(client);
        if (session) {
          session.conversationId = msg.threadId ?? session.conversationId;
          session.agentId = msg.agentDetails?.id ?? msg.agentDetails?.agent_id ?? session.agentId;
          session.companyId = msg.agentDetails?.companyId ?? session.companyId;
          session.customerId = msg.customerId ?? session.customerId;
          session.customerPhone = msg.customerPhNo || session.customerPhone;
          session.callId = msg.callId ?? session.callId;
          session.channel = msg.channel ?? session.channel;
          // The sentinel that kicks off the greeting isn't something the
          // customer actually said — keep it out of the transcript.
          if (typeof msg.text === 'string' && msg.text !== 'SYSTEM_START_CONVERSATION') {
            session.transcript.push({ speaker: 'customer', text: msg.text, timestamp: new Date() });
          }
        }

        for await (const chunk of this.agentService.runAgent(msg)) {
          const text = typeof chunk.text === 'string' ? chunk.text : (chunk as any).content ?? '';
          if (text) {
            session?.transcript.push({ speaker: 'agent', text, timestamp: new Date() });
          }
          if (text && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'token', text }));
          }
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
