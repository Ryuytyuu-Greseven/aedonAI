import WebSocket from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import {
  AgentModelUsage,
  AgentTextChunk,
  UserConfig,
} from '../types/assistant.types';
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

// How long an interrupted turn's socket stays open waiting for its usage.
const USAGE_WAIT_MS = 15_000;

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
   * `onUsage` gets the turn's LLM token usage from the agent's `done`.
   */
  public async *streamFromAgent(
    text: string,
    config: UserConfig,
    sessionId: string,
    isActive: () => boolean = () => true,
    language: string = 'en',
    onUsage?: (usage: AgentModelUsage[]) => void,
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

    const queue: Array<{
      type: string;
      text?: string;
      message?: string;
      usage?: AgentModelUsage[];
    }> = [];
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
    let usageReported = false;

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
          if (Array.isArray(item.usage)) onUsage?.(item.usage);
          usageReported = true;
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
      if (ws.readyState === WebSocket.OPEN) {
        if (usageReported || !onUsage) ws.close();
        else this.closeAfterUsage(ws, queue, onUsage);
      }
    }
  }

  /**
   * A barge-in stops reading mid-turn, but the agent still finishes the turn
   * and spends its tokens — wait (bounded) in the background for its `done`
   * so that usage is still counted, then close.
   */
  private closeAfterUsage(
    ws: WebSocket,
    queued: Array<{ type: string; usage?: AgentModelUsage[] }>,
    onUsage: (usage: AgentModelUsage[]) => void,
  ): void {
    const report = (item: { type: string; usage?: AgentModelUsage[] }) => {
      if (item.type !== 'done') return false;
      if (Array.isArray(item.usage)) onUsage(item.usage);
      return true;
    };
    if (queued.some(report)) {
      ws.close();
      return;
    }
    const timer = setTimeout(() => ws.close(), USAGE_WAIT_MS);
    timer.unref();
    ws.on('message', (data: Buffer) => {
      try {
        if (report(JSON.parse(data.toString()))) {
          clearTimeout(timer);
          ws.close();
        }
      } catch {
        /* ignore malformed */
      }
    });
    ws.once('close', () => clearTimeout(timer));
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
