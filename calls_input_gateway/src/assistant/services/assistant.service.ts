import WebSocket from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { SharedAiService } from './shared-ai.service';
import { AgentTextChunk, SessionState } from '../types/assistant.types';
import { isBackchannel } from '../speech/backchannel';
import { AgentRouterService } from './agent-router.service';
import { AudioDriverService } from './audio-driver.service';
import { FirebaseService } from '../../firebase/firebase.service';
import { CallLogService } from '../../call-logs/services/call-log.service';
import { AgentsRepository } from '../../call-logs/repositories/agents.repository';
import { AgentDocument } from '../../call-logs/schemas/agents.schema';
import { MetaLeadsRepository } from '../../call-logs/repositories/meta-leads.repository';
import { ConnectedPagesRepository } from '../../call-logs/repositories/connected-pages.repository';
import { CacheService } from '../../common/services/cache.service';
import { randomUUID } from 'crypto';
import { PINNED_LANGUAGE } from '../../common/config/pinned-language';
import { TurnLatency } from '../helpers/turn-latency';

/**
 * Plain-object clone of the resolved Agent document plus a `currentLanguage`
 * key. `language` (inherited from the spread) stays whatever the Agent's own
 * configured default is — never mutated. `currentLanguage` starts equal to
 * it and is the one field updated as live STT detects the caller switching
 * languages mid-call; this is what translation/TTS actually reads.
 */
type CachedAgentDetails = Record<string, any> & { currentLanguage: string };

interface SessionCacheEntry {
  agentDetails: CachedAgentDetails | null;
  phoneNumber?: string;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private sessions = new Map<any, SessionState>();

  constructor(
    private readonly sharedAiService: SharedAiService,
    private readonly agentRouter: AgentRouterService,
    private readonly firebaseService: FirebaseService,
    private readonly callLogService: CallLogService,
    private readonly audioDriverService: AudioDriverService,
    private readonly agentsRepository: AgentsRepository,
    private readonly metaLeadsRepository: MetaLeadsRepository,
    private readonly connectedPagesRepository: ConnectedPagesRepository,
    private readonly cacheService: CacheService,
  ) {}

  // ─── Session lifecycle ────────────────────────────────────────────────────

  public initializeSession(client: any): void {
    this.logger.log('Client connected — initializing session');

    if (!this.sharedAiService.hasValidApiKey()) {
      this.logger.error('API key is not configured.');
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ error: 'Service down' }));
      }
      client.close();
      return;
    }

    const session: SessionState = {
      config: this.sharedAiService.getDefaultConfig(),
      sessionId: randomUUID(),
      speechStarted: false,
      silenceStartTimestamp: 0,
      audioChunks: [],
      isGenerating: false,
      isProcessingQueue: false,
      turnInterrupted: false,
      fillerOnly: false,
      deferredBargeIn: false,
      abortTts: null,
      accumulatedTranscript: '',
      lastSegmentHadSpeech: false,
      isTranscribing: false,
      segmentIndex: 0,
      queryQueue: [],
      turnCount: 0,
      language: PINNED_LANGUAGE ?? 'en',
    };

    this.sessions.set(client, session);
  }

  public async cleanupSession(client: any): Promise<void> {
    this.logger.log('Client disconnected — cleaning up session');
    const session = this.sessions.get(client);
    if (session) {
      if (session.config.callId) {
        void this.callLogService.endCallLog(session.config.callId);
      }
      if (session.agentMongoId) {
        try {
          await this.agentsRepository.removeActiveSession(
            session.agentMongoId,
            session.sessionId,
          );
        } catch (err) {
          this.logger.error(
            `Failed to remove active_sessions entry for agent ${session.agentMongoId}: ${err}`,
          );
        }
      }
      this.cacheService.del(`session:${session.sessionId}`);
      this.sessions.delete(client);
    }
  }

  /**
   * Updates only `agentDetails.currentLanguage` on the session cache entry —
   * never the Agent's own configured `language` field, which stays intact
   * inside the same spread as the immutable default.
   */
  private updateSessionCurrentLanguage(
    sessionId: string,
    language: string,
  ): void {
    const key = `session:${sessionId}`;
    const existing = this.cacheService.get<SessionCacheEntry>(key);
    const agentDetails = existing?.agentDetails
      ? { ...existing.agentDetails, currentLanguage: language }
      : null;
    this.cacheService.set<SessionCacheEntry>(key, {
      agentDetails,
      phoneNumber: existing?.phoneNumber,
    });
  }

  /** Returns the sessionId for this client — used by AudioDriverService keying. */
  public getSessionId(client: any): string | undefined {
    return this.sessions.get(client)?.sessionId;
  }

  /**
   * Pushes an external Agent-doc config change (e.g. someone editing
   * `language` while a call is in progress) into any of THIS process's
   * currently-tracked sessions that belong to that agent — reconnecting
   * the live STT language exactly the way initiateAgentState does at call
   * start, just triggered by an edit instead of call setup.
   *
   * KNOWN LIMITATION: only reaches sessions live in this process. If this
   * gateway is ever horizontally scaled, Agent.active_sessions may list
   * sessions running on other instances that this method cannot correct —
   * not solved here; would need a fan-out mechanism (pub/sub, etc.) later.
   *
   * INTENTIONALLY NOT WIRED to any HTTP controller / queue consumer / change
   * stream yet — call site to be decided once it's known what triggers agent
   * edits (admin API, external agent-management service, etc.). Exists as a
   * callable capability for now.
   */
  public applyAgentUpdateToActiveSessions(
    agentMongoId: string,
    newLanguage: string,
  ): void {
    for (const [client, session] of this.sessions.entries()) {
      if (session.agentMongoId !== agentMongoId) continue;

      session.language = newLanguage;
      this.updateSessionCurrentLanguage(session.sessionId, newLanguage);

      const sttKey = (client as any).streamSid || session.sessionId;
      this.audioDriverService.applyPreferredLanguage(sttKey, newLanguage);

      this.logger.log(
        `[Config push] session=${session.sessionId} agent=${agentMongoId} language→${newLanguage}`,
      );
    }
  }

  // ─── Setup message ────────────────────────────────────────────────────────

  public async initiateAgentState(
    client: any,
    setupConfig: any,
  ): Promise<void> {
    const session = this.sessions.get(client);
    if (!session) return;

    session.config = this.sharedAiService.parseSetupConfig(setupConfig);
    // Telephony gateways (Twilio/Exotel) pass the real provider CallSid as
    // callId; webrtc sessions fall back to the internal sessionId.
    if (!session.config.callId) {
      session.config.callId = session.sessionId;
    }

    // ─── Resolve the business's Agent doc, cache it (with a currentLanguage ───
    // ─── clone key), and correct STT/TTS before the greeting fires ─────────
    // Two resolution strategies, tried in order — whichever applies to this
    // session's transport:
    //   1. Phone-number based (real Twilio/Exotel calls, and webrtc staging
    //      sessions that send `phoneNumber` in place of `business`): the
    //      business's own number — Twilio's `agentNumber` (from
    //      customParameters.businessNumber), or `phoneNumber` in that
    //      webrtc-staging flow, where it also carries the business's own
    //      number, not a customer's.
    //   2. agentId based (webrtc/chat clients that supply a real Mongo
    //      agent_id directly in their `setup` message) — agent_id is unique
    //      per agent template, unlike phone_number, so no status filter is
    //      needed here to disambiguate.
    // Resolved fresh from Mongo every session (not cached by phone/agentId —
    // that caching was cross-session by business identity and could serve
    // stale Agent data for up to its TTL after an edit; this only runs once
    // per call setup, not per turn, so a direct DB hit here is cheap).
    const businessNumber =
      session.config.agentNumber || session.config.phoneNumber || undefined;
    let resolvedAgent: AgentDocument | null = null;
    if (businessNumber) {
      resolvedAgent =
        await this.agentsRepository.filterByPhoneNumber(businessNumber);
    }
    if (!resolvedAgent && session.config.agentId) {
      resolvedAgent = await this.agentsRepository.filterByAgentId(
        session.config.agentId,
      );
    }

    const agentPlain: Record<string, any> | null = resolvedAgent
      ? typeof (resolvedAgent as any).toObject === 'function'
        ? (resolvedAgent as any).toObject()
        : resolvedAgent
      : null;
    const agentDetails: CachedAgentDetails | null = agentPlain
      ? {
          ...agentPlain,
          currentLanguage:
            PINNED_LANGUAGE || agentPlain.language || session.language,
        }
      : null;

    session.agentMongoId = agentPlain?._id ? String(agentPlain._id) : undefined;
    // Telephony setups carry no agentId of their own — adopt the resolved
    // Agent's agent_id so call_logs (and the router's fallback lookup) are
    // attributed to the right agent instead of an empty id.
    if (agentPlain?.agent_id) {
      session.config.agentId = String(agentPlain.agent_id);
    }
    // The voice saved on the agent wins over whatever the client/Twilio sent
    // (historically a hard-coded Google voice name). TTS providers map the
    // code to their own voices.
    if (agentPlain?.voice) {
      session.config.voice = String(agentPlain.voice);
    }

    const initialLanguage = agentDetails?.currentLanguage || session.language;
    session.language = initialLanguage;
    this.cacheService.set<SessionCacheEntry>(`session:${session.sessionId}`, {
      agentDetails,
      phoneNumber: session.config.phoneNumber,
    });

    if (agentDetails || PINNED_LANGUAGE) {
      // Correct STT connection B immediately — bypasses live-classification
      // hysteresis since this is a confident, config-sourced language, not a
      // noisy guess. sttKey matches how AudioDriverService/DeepGram are
      // actually keyed per gateway: Twilio's adapter exposes `.streamSid`;
      // a raw webrtc socket doesn't, so this falls through to sessionId.
      const sttKey = (client as any).streamSid || session.sessionId;
      this.audioDriverService.applyPreferredLanguage(sttKey, initialLanguage);
    }

    // Track this call as live on the Agent doc — fire-and-forget, same
    // pattern as other non-critical persistence side-effects in this
    // pipeline. See cleanupSession for why removal is NOT fire-and-forget.
    if (session.agentMongoId) {
      void this.agentsRepository
        .addActiveSession(session.agentMongoId, {
          sessionId: session.sessionId,
          callId: session.config.callId!,
          provider: session.config.provider ?? 'webrtc',
          direction: session.config.direction ?? 'inbound',
          phoneNumber: session.config.phoneNumber ?? null,
          startedAt: new Date(),
        })
        .catch((err) =>
          this.logger.error(
            `Failed to add active_sessions entry for agent ${session.agentMongoId}: ${err}`,
          ),
        );
    }

    // WebRTC connections through /ws are inherently test/demo traffic (real
    // customer calls only ever arrive via the Twilio/Exotel gateway) — drop
    // a placeholder lead into meta_leads for each one. Fire-and-forget (the
    // method itself awaits the ConnectedPage lookup internally, but this
    // call site never blocks call setup on it), same pattern as the
    // active_sessions tracking above.
    if (session.config.provider === 'webrtc') {
      void this.createDemoMetaLead(session, agentPlain).catch((err) =>
        this.logger.error(
          `Failed to create demo meta_leads entry for session ${session.sessionId}: ${err}`,
        ),
      );
    }

    this.logger.log(
      `Agent configured: business="${session.config.business}", voice="${session.config.voice}", provider="${session.config.provider}", \nAgentId: "${session.config.agentId}", resolvedLanguage="${initialLanguage}"`,
    );

    await this.callLogService.startCallLog({
      callId: session.config.callId,
      provider: session.config.provider ?? 'webrtc',
      direction: session.config.direction ?? 'inbound',
      phoneNumber: session.config.phoneNumber,
      agentTemplateId: session.config.business ?? 'unknown',
      agentId: session.config.agentId || 'unknown',
      agentNumber: session.config.agentNumber,
    });

    // Trigger initial greeting
    session.queryQueue.push({
      text: 'SYSTEM_START_CONVERSATION',
      latency: this.startTurnLatency(session, 'call start (greeting)'),
    });
    this.processQueryQueue(client, session);
  }

  /**
   * Inserts a placeholder meta_leads entry for a WebRTC test/demo call,
   * sourcing real identifiers instead of synthesizing them:
   *   - customerId: the resolved Agent's own companyId.
   *   - pageId: the ConnectedPage linked to this Agent's Mongo _id — an
   *     agent is expected to have exactly one; anything else (none, or
   *     more than one) means we can't get an unambiguous real pageId, so
   *     this skips creating the lead rather than guessing/fabricating one.
   * leadgenId has no real-world equivalent for a demo call, so that alone
   * stays synthesized (`demo-<uuid>`) to satisfy the required+unique field.
   */
  private async createDemoMetaLead(
    session: SessionState,
    agentPlain: Record<string, any> | null,
  ): Promise<void> {
    if (!session.agentMongoId || !agentPlain) return;

    const customerId = agentPlain.companyId;
    if (!customerId) {
      this.logger.warn(
        `Skipping demo meta_leads insert — agent ${session.agentMongoId} has no companyId`,
      );
      return;
    }

    const connectedPages = await this.connectedPagesRepository.findByAgentId(
      session.agentMongoId,
    );
    if (connectedPages.length !== 1) {
      this.logger.warn(
        `Skipping demo meta_leads insert — agent ${session.agentMongoId} has ${connectedPages.length} connected pages (expected exactly 1)`,
      );
      return;
    }
    const pageId = connectedPages[0].pageId;

    await this.metaLeadsRepository.create({
      customerId,
      pageId,
      leadgenId: `demo-${randomUUID()}`,
      fullName: 'Demo Caller',
      phoneNumber: session.config.phoneNumber || '0000000000',
      metaCreatedAt: new Date(),
      customFields: {
        sessionId: session.sessionId,
        callId: session.config.callId,
        agentMongoId: session.agentMongoId,
        business: session.config.business,
      },
      callAttempts: [
        { callId: session.config.callId!, attemptedAt: new Date() },
      ],
    });
  }

  // ─── AudioDriver callbacks ────────────────────────────────────────────────

  /**
   * Called by AudioDriverService when the caller starts a new utterance,
   * with the first interim transcript when the STT provider has one (Sarvam
   * only signals start of speech). Interrupts any in-progress turn — except
   * while only a filler has played: then an acknowledgement ("okay") or
   * not-yet-known words don't cancel the pending reply; the decision waits
   * for the final transcript (see onTranscriptReady).
   */
  public handleBargeIn(client: any, transcript?: string): void {
    const session = this.sessions.get(client);
    if (!session || !session.isGenerating) return;

    if (
      session.fillerOnly &&
      (transcript === undefined || isBackchannel(transcript))
    ) {
      this.logger.log(
        `[Barge-in] Deferred during filler ("${transcript ?? '…'}") — waiting for the final transcript.`,
      );
      session.deferredBargeIn = true;
      return;
    }

    this.interruptTurn(client, session);
  }

  private interruptTurn(client: any, session: SessionState): void {
    this.logger.log('[Barge-in] User started speaking — interrupting AI.');
    session.turnInterrupted = true;
    session.isGenerating = false;
    session.abortTts?.();

    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ serverContent: { interrupted: true } }));
    }
  }

  private sendServerContent(
    client: any,
    content: Record<string, unknown>,
  ): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ serverContent: content }));
    }
  }

  /**
   * Called by AudioDriverService once STT returns a finalized transcript for
   * the user's utterance. Queues it for the LLM pipeline.
   */
  public onTranscriptReady(
    client: any,
    text: string,
    language: string = 'en',
  ): void {
    const session = this.sessions.get(client);
    if (!session || !text.trim()) return;

    if (session.deferredBargeIn) {
      session.deferredBargeIn = false;
      if (isBackchannel(text)) {
        // "okay" over a filler: let the pending reply play, and don't send
        // the acknowledgement to the agent as a new question.
        this.logger.log(`[Barge-in] Ignored acknowledgement "${text}".`);
        return;
      }
      if (session.isGenerating) this.interruptTurn(client, session);
    }

    // A pinned language holds the session (and so the agent's reply
    // language and the TTS voice) whatever STT detected for this utterance.
    const sessionLanguage = PINNED_LANGUAGE || language;
    session.language = sessionLanguage;
    this.updateSessionCurrentLanguage(session.sessionId, sessionLanguage);
    this.logger.log(`[Transcript] (${language}) "${text}"`);

    // Echo to frontend so it can display the user's words
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ userContent: { text } }));
    }

    // Persist the user's message
    void this.firebaseService.saveMessage(
      session.sessionId,
      'user',
      text,
      session.config.business ?? 'unknown',
    );

    session.queryQueue.push({
      text,
      latency: this.startTurnLatency(session, 'transcript ready', text),
    });
    this.processQueryQueue(client, session);
  }

  // ─── LLM + TTS pipeline ──────────────────────────────────────────────────

  private async processQueryQueue(
    client: any,
    session: SessionState,
  ): Promise<void> {
    if (session.isProcessingQueue) return;
    if (!session.queryQueue || session.queryQueue.length === 0) return;

    session.isProcessingQueue = true;

    try {
      while (session.queryQueue.length > 0) {
        const { text: queryText, latency } = session.queryQueue.shift()!;
        session.turnLatency = latency;
        session.turnInterrupted = false;
        session.fillerOnly = false;
        session.deferredBargeIn = false;
        session.isGenerating = true;
        this.sendServerContent(client, { turnStart: true });

        try {
          this.logger.log(`[LLM] Processing: "${queryText}"`);
          latency.mark('sent to agent');

          const rawStream = this.agentRouter.streamFromAgent(
            queryText,
            session.config,
            session.sessionId,
            () => session.isGenerating,
            session.language,
            latency.turnId,
          );
          const { stream: responseStream, getText } = this.captureTextStream(
            rawStream,
            (chunk) => {
              // Filler-only until the first piece of the real reply.
              session.fillerOnly = !!chunk.filler && getText() === '';
              if (chunk.filler) latency.markOnce('agent first filler', chunk.text);
              else latency.markOnce('agent first reply', chunk.text);
            },
            () => latency.mark('agent done', getText()),
          );

          await this.sharedAiService.textToSpeech(
            responseStream,
            session.config.voice,
            (base64Audio, text) => this.onAudioChunk(base64Audio, text, client),
            session,
            client,
          );

          latency.mark('tts done (all audio sent)');

          const aiText = getText();
          if (aiText && queryText !== 'SYSTEM_START_CONVERSATION') {
            void this.firebaseService.saveMessage(
              session.sessionId,
              'assistant',
              aiText,
              session.config.business ?? 'unknown',
            );
          }

          if (!session.turnInterrupted) {
            this.sendServerContent(client, { turnComplete: true });
          }
        } catch (err: any) {
          this.logger.error('Error in LLM/TTS pipeline:', err);
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                error: `Processing error: ${err.message || err}`,
              }),
            );
          }
        } finally {
          session.abortTts = null;
          session.isGenerating = false;
          session.turnLatency = null;
        }
      }
    } finally {
      session.isProcessingQueue = false;
    }
  }

  /**
   * Wraps an async generator so callers can still iterate it normally while
   * we silently accumulate the reply text yielded by each chunk (fillers are
   * spoken but not part of the reply). `onChunk` sees every chunk before it
   * goes to TTS. getText() returns the concatenated result after the stream
   * is exhausted.
   */
  private captureTextStream(
    source: AsyncGenerator<AgentTextChunk>,
    onChunk?: (chunk: AgentTextChunk) => void,
    onEnd?: () => void,
  ): {
    stream: AsyncGenerator<AgentTextChunk>;
    getText: () => string;
  } {
    let accumulated = '';
    const stream = (async function* () {
      for await (const chunk of source) {
        onChunk?.(chunk);
        const t =
          typeof chunk?.text === 'string'
            ? chunk.text
            : ((chunk as any)?.content ?? '');
        if (t && !chunk.filler) accumulated += t;
        yield chunk;
      }
      onEnd?.();
    })();
    return { stream, getText: () => accumulated };
  }

  /** Starts a turn's latency trail, logging its first mark. */
  private startTurnLatency(
    session: SessionState,
    event: string,
    detail?: string,
  ): TurnLatency {
    session.turnCount++;
    const latency = new TurnLatency(
      `${session.sessionId.slice(0, 8)}#${session.turnCount}`,
    );
    latency.mark(event, detail);
    return latency;
  }

  // Streams synthesized audio and text chunks back to the WebSocket client
  onAudioChunk(base64Audio: string, text: string, client: any): void {
    const session = this.sessions.get(client);
    if (session && !session.isGenerating) return;

    const parts: any[] = [];
    if (base64Audio) {
      parts.push({ inlineData: { mimeType: 'audio/l16', data: base64Audio } });
    }
    if (text) {
      parts.push({ text });
    }

    if (parts.length === 0) return;

    this.sendServerContent(client, { modelTurn: { parts } });
  }
}
