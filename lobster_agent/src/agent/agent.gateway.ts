import WebSocket from 'ws';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { resolveTraceId, TurnTrace } from './turn-trace.js';

// One WS connection = one call, per the audio_processor's own
// connect/disconnect-per-call lifecycle (see handleConnection/handleDisconnect logs).
@WebSocketGateway({ path: '/agent', cors: true })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentGateway.name);

  constructor(private readonly agentService: AgentService) {}

  handleConnection(client: WebSocket): void {
    this.logger.log('audio_processor connected');

    client.on('message', async (data) => {
      let trace: TurnTrace | null = null;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type !== 'message') return;

        const turnTrace = new TurnTrace(resolveTraceId(msg));
        trace = turnTrace;
        turnTrace.in('message', msg.text);
        // Every message back to the gateway goes through here, so each one
        // is logged OUT with this turn's trace id.
        const send = (type: string, payload: Record<string, unknown> = {}) => {
          if (client.readyState !== WebSocket.OPEN) return;
          client.send(JSON.stringify({ type, ...payload }));
          turnTrace.out(type, (payload.text ?? payload.message) as string | undefined);
        };

        const turnStartedAt = turnTrace.startedAt;
        let routedNode: string | null = null;
        let routedAtMs: number | null = null;
        let firstReplyAtMs: number | null = null;

        try {
          for await (const event of this.agentService.runAgent(msg)) {
            if (event.kind === 'route') {
              routedNode ??= event.node;
              routedAtMs ??= Date.now() - turnStartedAt;
              turnTrace.note('route', event.node);
              continue;
            }
            firstReplyAtMs ??= Date.now() - turnStartedAt;
            send('token', { text: event.text });
          }
        } finally {
          this.logger.log(
            `[turn] trace=${turnTrace.traceId} session=${msg.sessionId} node=${routedNode ?? '-'} router=${routedAtMs ?? '-'}ms ` +
              `first_reply=${firstReplyAtMs ?? '-'}ms total=${Date.now() - turnStartedAt}ms`,
          );
        }

        send('done');
      } catch (err: any) {
        this.logger.error('Agent error:', err.message);
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'error', message: err.message }));
          trace?.out('error', err.message);
        }
      }
    });

    client.on('error', (err) => this.logger.error('Client socket error:', err.message));
  }

  handleDisconnect(_client: WebSocket): void {
    this.logger.log('audio_processor disconnected');
  }
}
