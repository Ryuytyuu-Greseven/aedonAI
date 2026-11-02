import WebSocket from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { AgentTextChunk, UserConfig } from '../types/assistant.types';
import { CallChannel } from '../../call-logs/interfaces/call-log.interface';
import { getAgentUrl } from '../../common/config/business-agents.registry';
import { CallLogService } from '../../call-logs/services/call-log.service';
import { AgentsRepository } from '../../call-logs/repositories/agents.repository';
import { CacheService } from '../../common/services/cache.service';

type CachedAgentDetails = Record<string, any> & { currentLanguage: string };
interface SessionCacheEntry {
  agentDetails: CachedAgentDetails | null;
  phoneNumber?: string;
}

@Injectable()
export class AgentRouterService {
  private readonly logger = new Logger(AgentRouterService.name);

  constructor(
    private readonly callLogService: CallLogService,
    private readonly agentRepo: AgentsRepository,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Connects to the appropriate domain agent server, sends the user text,
   * and yields response tokens one-by-one as the agent streams them back.
   * Drop-in replacement for AgentService.runAgent() — same yield shape.
   */
  public async *streamFromAgent(
    text: string,
    config: UserConfig,
    sessionId: string,
    isActive: () => boolean = () => true,
    language: string = 'en',
  ): AsyncGenerator<AgentTextChunk> {
    const baseUrl = getAgentUrl(config.business);
    const url = `${baseUrl}/agent`;
    this.logger.log(`[Router] ${config.business} → ${url}`);

    // Call-log identifier: real Twilio/Exotel CallSid for telephony
    // sessions, or the internal sessionId for webrtc ones — always set by
    // AssistantService.initiateAgentState before this generator runs.
    const callId = config.callId ?? sessionId;

    if (text !== 'SYSTEM_START_CONVERSATION') {
      void this.callLogService.logMessage(callId, {
        message: text,
        speaker: 'customer',
      });
    }

    const ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    // agentDetails (with its currentLanguage) is resolved once, up front, by
    // AssistantService.initiateAgentState — before any turn/greeting runs —
    // and cached per session. Read it from there instead of re-fetching
    // from Mongo on every single turn; fall back to a direct DB fetch only
    // if that cache entry is somehow missing (shouldn't normally happen).
    const cached = this.cacheService.get<SessionCacheEntry>(
      `session:${sessionId}`,
    );
    let agentDetails: CachedAgentDetails | null = cached?.agentDetails ?? null;
    if (!agentDetails) {
      const fetched = await this.agentRepo.filterByAgentId(config.agentId);
      const fetchedPlain =
        fetched && typeof (fetched as any).toObject === 'function'
          ? (fetched as any).toObject()
          : fetched;
      agentDetails = fetchedPlain
        ? {
            ...fetchedPlain,
            currentLanguage: language,
            greeting: fetchedPlain.greeting || config.greeting,
          }
        : config.greeting
          ? ({ greeting: config.greeting, currentLanguage: language } as any)
          : null;
    }
    const effectiveLanguage = agentDetails?.currentLanguage || language;

    ws.send(
      JSON.stringify({
        type: 'message',
        text,
        agentId: config.agentId,
        agentDetails,
        sessionId,
        threadId: sessionId,
        callId,
        channel: resolveChannel(config),
        systemInstruction: config.systemInstruction ?? '',
        business: config.business ?? '',
        customerId: '',
        customerPhNo: config.phoneNumber ?? '',
        language: effectiveLanguage,
      }),
    );

    const queue: Array<{ type: string; text?: string; message?: string }> = [];
    let notify: (() => void) | null = null;
    let closed = false;

    const wake = () => {
      if (notify) {
        notify();
        notify = null;
      }
    };

    ws.on('message', (data: Buffer) => {
      try {
        queue.push(JSON.parse(data.toString()));
        wake();
      } catch {
        /* ignore malformed */
      }
    });
    ws.on('close', () => {
      closed = true;
      wake();
    });
    ws.on('error', (err) => {
      this.logger.error('[Router] WS error:', err.message);
      closed = true;
      wake();
    });

    let agentResponse = '';

    try {
      while (true) {
        if (!isActive()) break;

        if (queue.length === 0) {
          if (closed) break;
          await new Promise<void>((res) => {
            notify = res;
          });
          continue;
        }

        const item = queue.shift()!;
        if (item.type === 'filler' && item.text) {
          // A holding line while the agent works — spoken, not logged.
          if (!isActive()) break;
          yield { text: item.text, filler: true };
        } else if (item.type === 'token' && item.text) {
          if (!isActive()) break;
          agentResponse += item.text;
          yield { text: item.text };
        } else if (item.type === 'end_call') {
          yield { text: '', endCall: true };
          break;
        } else if (item.type === 'done') {
          if ((item as any).endCall) {
            yield { text: '', endCall: true };
          }
          break;
        } else if (item.type === 'error') {
          throw new Error(item.message ?? 'Domain agent error');
        }
      }
    } finally {
      if (agentResponse.trim()) {
        void this.callLogService.logMessage(callId, {
          message: agentResponse,
          speaker: 'ai_agent',
        });
      }
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
  }
}

/**
 * Playground traffic is 'preview': explicitly tagged phone previews, and every
 * webrtc session (real customer calls only ever arrive via Twilio/Exotel).
 */
export function resolveChannel(config: UserConfig): CallChannel {
  if (config.channel === 'preview') return 'preview';
  return (config.provider ?? 'webrtc') === 'webrtc' ? 'preview' : 'live';
}
