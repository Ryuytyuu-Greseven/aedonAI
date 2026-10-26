import { DeepgramClient } from '@deepgram/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { V1Socket } from 'node_modules/@deepgram/sdk/dist/cjs/api/resources/listen/resources/v1/client/Socket';
import {
  LanguageIdService,
  SpokenLanguage,
} from '../../services/language-id.service';

// nova-3 `language: 'multi'` code-switches natively among en/es/fr/de/hi/ru/pt/
// ja/it/nl — Hindi is covered, but Telugu/Tamil/Kannada are not, and Deepgram's
// `detect_language` flag doesn't work on streaming connections at all. So we
// run TWO connections in parallel for the whole call: connection A always
// stays on `multi` (en/hi, never reconnected); connection B is always one of
// te/ta/kn and gets reconnected (only itself, A is untouched) when Vertex AI
// confirms the speaker moved into a different one of those three.
const MANUAL_SWITCH_LANGUAGES = new Set(['te', 'ta', 'kn']);

// Rolling "fallback" audio buffer cap — audio accumulated while BOTH
// connections have failed to produce a transcript for the current
// not-yet-resolved utterance(s). Bounded so a stuck/never-finalizing stretch
// can't grow this unboundedly (~10s at 16kHz/16-bit).
const MAX_FALLBACK_BUFFER_BYTES = 10 * 16000 * 2;

// How long to wait, after one connection reports an empty final, before
// deciding the sibling connection isn't also about to report on the same
// utterance — absorbs normal jitter between two independent Deepgram
// sessions without adding much perceptible lag.
const FALLBACK_DEBOUNCE_MS = 400;

// Window after a real delivered transcript during which a same-utterance
// final (empty or non-empty) from the *other* connection is treated as the
// loser of that utterance, not a new event.
const DEDUPE_WINDOW_MS = 1200;

// Deepgram's single-language (te/ta/kn) models don't reliably return empty
// for out-of-language audio — they can phonetically transliterate it into
// their own script instead (confirmed live: English speech produced
// confident, well-formed Telugu-script text on a 'te' connection). 'multi'
// (connection A) is authoritative for en/hi, so B's non-empty results are
// held for this long to give A a chance to weigh in and win first, instead
// of trusting whichever connection simply finalizes first.
const B_RESULT_GRACE_MS = 400;

// Don't spend a Vertex AI call on less than this much accumulated fallback
// audio — too little for reliable classification. This (not resetting per
// tiny fragment) is the fix for a real bug: a v1 test showed classification
// attempts running on well under a second of audio, taking ~10s to converge.
const MIN_FALLBACK_SECONDS = 1.5;

interface ConnectionState {
  socket: V1Socket;
  label: 'A' | 'B';
  language: string; // 'multi' for A (fixed); te|ta|kn for B (reconnectable)
  lastInterimTranscript: string;
  lastInterimLanguage: string | null;
  dumpSeq: number;
}

interface SttSessionState {
  connections: { A: ConnectionState; B: ConnectionState };

  // Hysteresis for reconnecting B.
  lastSwitchAt: number;
  pendingLanguage: SpokenLanguage | null;
  pendingConfirmations: number;
  isSwitchingB: boolean;

  // Serializes Vertex AI calls so two near-simultaneous empty finals (one
  // per connection) never race two concurrent classification attempts.
  isCheckingLanguage: boolean;

  // Cross-utterance fallback audio — cleared only when an utterance
  // resolves with a real transcript, or right after a successful B switch.
  fallbackAudio: Buffer[];
  fallbackAudioBytes: number;
  fallbackDebounceTimer: NodeJS.Timeout | null;

  // Cross-connection delivery dedupe.
  lastDeliveryAt: number;
}

@Injectable()
export class DeepGram {
  logger = new Logger(DeepGram.name);
  private sttState = new Map<string, SttSessionState>();

  private readonly secondLanguage: string;
  private readonly endpointingMs: number;
  private readonly utteranceEndMs: number;
  private readonly requiredConfirmations: number;
  private readonly switchCooldownMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly languageIdService: LanguageIdService,
  ) {
    this.secondLanguage =
      this.configService.get<string>('SECOND_STT_LANGUAGE') || 'te';
    this.endpointingMs =
      Number(this.configService.get<string>('DEEPGRAM_ENDPOINTING_MS')) || 300;
    this.utteranceEndMs =
      Number(this.configService.get<string>('DEEPGRAM_UTTERANCE_END_MS')) ||
      1000;
    this.requiredConfirmations =
      Number(this.configService.get<string>('LANGUAGE_SWITCH_CONFIRMATIONS')) ||
      2;
    this.switchCooldownMs =
      Number(this.configService.get<string>('LANGUAGE_SWITCH_COOLDOWN_MS')) ||
      8000;
  }

  async openConnection(sessionId: string, activeSession: any) {
    const [socketA, socketB] = await Promise.all([
      this.createSocket(sessionId, activeSession, 'multi'),
      this.createSocket(sessionId, activeSession, this.secondLanguage),
    ]);

    const connA: ConnectionState = {
      socket: socketA,
      label: 'A',
      language: 'multi',
      lastInterimTranscript: '',
      lastInterimLanguage: null,
      dumpSeq: 0,
    };
    const connB: ConnectionState = {
      socket: socketB,
      label: 'B',
      language: this.secondLanguage,
      lastInterimTranscript: '',
      lastInterimLanguage: null,
      dumpSeq: 0,
    };

    this.sttState.set(sessionId, {
      connections: { A: connA, B: connB },
      lastSwitchAt: 0,
      pendingLanguage: null,
      pendingConfirmations: 0,
      isSwitchingB: false,
      isCheckingLanguage: false,
      fallbackAudio: [],
      fallbackAudioBytes: 0,
      fallbackDebounceTimer: null,
      lastDeliveryAt: 0,
    });

    this.wireMessageHandlers(sessionId, connA, activeSession);
    this.wireMessageHandlers(sessionId, connB, activeSession);
  }

  feedAudio(
    sessionId: string,
    audioData: Buffer<ArrayBuffer>,
    activeSession: any,
  ) {
    const state = this.sttState.get(sessionId);
    if (!state) return;

    state.fallbackAudio.push(Buffer.from(audioData));
    state.fallbackAudioBytes += audioData.length;
    while (
      state.fallbackAudioBytes > MAX_FALLBACK_BUFFER_BYTES &&
      state.fallbackAudio.length > 1
    ) {
      const dropped = state.fallbackAudio.shift()!;
      state.fallbackAudioBytes -= dropped.length;
    }

    state.connections.A.socket.sendMedia(audioData);
    state.connections.B.socket.sendMedia(audioData);
  }

  closeConnection(sessionId: string) {
    const state = this.sttState.get(sessionId);
    if (!state) return;

    this.logger.log('Closing connections for: ' + sessionId);
    if (state.fallbackDebounceTimer) clearTimeout(state.fallbackDebounceTimer);
    for (const label of ['A', 'B'] as const) {
      try {
        state.connections[label].socket.close();
      } catch {
        // best effort
      }
    }
    this.sttState.delete(sessionId);
  }

  // ─── Connection lifecycle ──────────────────────────────────────────────

  private async createSocket(
    sessionId: string,
    activeSession: any,
    language: string,
  ): Promise<V1Socket> {
    this.logger.log(`\nNew Connection to Deepgram (lang=${language})`);
    const client = new DeepgramClient();
    const encoding = activeSession.encoding === 'MULAW' ? 'mulaw' : 'linear16';
    const sampleRate = activeSession.sampleRateHertz ?? 16000;

    const connection = await client.listen.v1.connect({
      model: 'nova-3',
      language,
      punctuate: 'true',
      detect_entities: 'true',
      interim_results: 'true',
      endpointing: this.endpointingMs,
      utterance_end_ms: this.utteranceEndMs,
      encoding,
      sample_rate: sampleRate,
      Authorization: this.configService.get<string>('DEEPGRAM_API_KEY') || '',
    });

    connection.on('open', () =>
      this.logger.log(`Connection opened ${sessionId} (lang=${language})`),
    );

    connection.connect();
    await connection.waitForOpen();
    return connection;
  }

  private wireMessageHandlers(
    sessionId: string,
    connState: ConnectionState,
    activeSession: any,
  ) {
    connState.socket.on('message', (data) => {
      if (data.type === 'Results') {
        this.dumpResult(sessionId, connState, data);

        const transcript = data.channel?.alternatives?.[0]?.transcript ?? '';
        const detected = data.channel?.alternatives?.[0]?.languages?.[0];

        if (data.speech_final) {
          this.handleUtteranceFinal(
            sessionId,
            connState,
            transcript,
            detected,
            activeSession,
          );
          return;
        }

        if (!transcript.trim()) return;

        connState.lastInterimTranscript = transcript;
        connState.lastInterimLanguage = detected ?? null;

        // Interim speech — fire barge-in once per utterance. Both
        // connections' handlers share the same activeSession object, so
        // whichever fires first wins and the guard still holds.
        if (!activeSession.speechDetectedByGoogle) {
          activeSession.speechDetectedByGoogle = true;
          activeSession.callbacks.onBargeIn(transcript);
        }
        return;
      }

      if (data.type === 'UtteranceEnd') {
        // Acoustic fallback for when speech_final never arrives — reuse the
        // last interim transcript this connection saw. If empty, this
        // connection already resolved (or never had) this utterance.
        if (!connState.lastInterimTranscript.trim()) return;
        const transcript = connState.lastInterimTranscript;
        const detected = connState.lastInterimLanguage ?? undefined;
        this.handleUtteranceFinal(
          sessionId,
          connState,
          transcript,
          detected,
          activeSession,
        );
      }
    });
  }

  private dumpResult(sessionId: string, connState: ConnectionState, data: any) {
    const dir = path.join(process.cwd(), 'logs', 'deepgram', sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(
      dir,
      `${connState.label}_${connState.language}_${Date.now()}_${connState.dumpSeq++}.json`,
    );
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    this.logger.log(`deepgram data → ${filePath}`);
  }

  // ─── Utterance resolution (dedupe across the two connections) ──────────

  private handleUtteranceFinal(
    sessionId: string,
    connState: ConnectionState,
    transcript: string,
    detectedLanguage: string | undefined,
    activeSession: any,
  ) {
    const state = this.sttState.get(sessionId);
    if (!state) return;

    const trimmed = (transcript || '').trim();
    connState.lastInterimTranscript = ''; // consumed either way

    if (!trimmed) {
      activeSession.speechDetectedByGoogle = false;
      this.handleEmptyFinal(sessionId, state, activeSession);
      return;
    }

    activeSession.speechDetectedByGoogle = false;

    if (connState.label === 'A') {
      // 'multi' is authoritative for en/hi — deliver immediately, no
      // added latency for the common case.
      this.deliverTranscript(
        state,
        connState,
        trimmed,
        detectedLanguage,
        activeSession,
      );
      return;
    }

    // connState.label === 'B': hold briefly so A gets a chance to win first
    // if it also has a result for this same utterance (see B_RESULT_GRACE_MS).
    setTimeout(() => {
      if (Date.now() - state.lastDeliveryAt < DEDUPE_WINDOW_MS) {
        this.logger.log(`[B] discarded (A won this utterance): "${trimmed}"`);
        return;
      }
      this.deliverTranscript(
        state,
        connState,
        trimmed,
        detectedLanguage,
        activeSession,
      );
    }, B_RESULT_GRACE_MS);
  }

  private deliverTranscript(
    state: SttSessionState,
    connState: ConnectionState,
    trimmed: string,
    detectedLanguage: string | undefined,
    activeSession: any,
  ) {
    const now = Date.now();
    if (now - state.lastDeliveryAt < DEDUPE_WINDOW_MS) {
      // Sibling connection already delivered this same utterance moments
      // ago — this is the loser of the pair, not a new event.
      this.logger.log(
        `[${connState.label}] suppressed duplicate: "${trimmed}"`,
      );
      return;
    }

    state.lastDeliveryAt = now;
    const reportedLanguage = detectedLanguage || connState.language;
    activeSession.callbacks.onTranscript(trimmed, reportedLanguage);
    this.logger.log(`[${connState.label}:${reportedLanguage}] ${trimmed}`);

    this.clearFallback(state); // utterance resolved — nothing to classify
  }

  private handleEmptyFinal(
    sessionId: string,
    state: SttSessionState,
    activeSession: any,
  ) {
    // A check is already scheduled or in flight for the current unresolved
    // utterance window — feedAudio keeps growing fallbackAudio meanwhile,
    // no need for a second timer or a second Vertex AI call.
    if (state.fallbackDebounceTimer || state.isCheckingLanguage) return;

    state.fallbackDebounceTimer = setTimeout(() => {
      state.fallbackDebounceTimer = null;
      // If the sibling connection delivered a real transcript for this same
      // utterance while we were waiting, there's nothing to classify.
      if (Date.now() - state.lastDeliveryAt < DEDUPE_WINDOW_MS) return;
      void this.checkLanguageSwitch(sessionId, activeSession);
    }, FALLBACK_DEBOUNCE_MS);
  }

  private clearFallback(state: SttSessionState) {
    state.fallbackAudio = [];
    state.fallbackAudioBytes = 0;
    if (state.fallbackDebounceTimer) {
      clearTimeout(state.fallbackDebounceTimer);
      state.fallbackDebounceTimer = null;
    }
  }

  // ─── Language switching (connection B only) ────────────────────────────

  private async checkLanguageSwitch(sessionId: string, activeSession: any) {
    const state = this.sttState.get(sessionId);
    if (!state || state.isCheckingLanguage || state.isSwitchingB) return;

    const bytesPerSecond =
      activeSession.encoding === 'MULAW'
        ? activeSession.sampleRateHertz
        : activeSession.sampleRateHertz * 2;
    if (state.fallbackAudioBytes < bytesPerSecond * MIN_FALLBACK_SECONDS) {
      return; // not enough accumulated yet — keep waiting, don't spend a call
    }

    state.isCheckingLanguage = true;
    try {
      const audio = Buffer.concat(state.fallbackAudio);
      const detected = await this.languageIdService.identifyLanguage(
        audio,
        activeSession.encoding,
        activeSession.sampleRateHertz,
      );
      if (!detected || detected === 'unclear') return; // no signal

      const currentB = state.connections.B.language;
      const alreadyCovered =
        detected === 'en' || detected === 'hi' || detected === currentB;
      if (alreadyCovered) {
        state.pendingLanguage = null;
        state.pendingConfirmations = 0;
        return;
      }

      if (Date.now() - state.lastSwitchAt < this.switchCooldownMs) return;

      if (state.pendingLanguage === detected) {
        state.pendingConfirmations++;
      } else {
        state.pendingLanguage = detected;
        state.pendingConfirmations = 1;
      }

      if (state.pendingConfirmations >= this.requiredConfirmations) {
        const target = MANUAL_SWITCH_LANGUAGES.has(detected)
          ? detected
          : this.secondLanguage;
        state.pendingLanguage = null;
        state.pendingConfirmations = 0;
        await this.switchConnectionB(sessionId, target, activeSession);
        this.clearFallback(state);
      }
    } finally {
      state.isCheckingLanguage = false;
    }
  }

  /**
   * Config-driven language correction (e.g. the calling business's
   * preferred/agent-configured language, resolved before the customer has
   * said anything) — bypasses the classification hysteresis entirely since
   * this is a confident, non-noisy signal, not a live audio guess.
   */
  async setPreferredLanguage(
    sessionId: string,
    language: string,
    activeSession: any,
  ): Promise<void> {
    const state = this.sttState.get(sessionId);
    if (!state) return; // connections not open yet — nothing to correct

    // en/hi are already covered by connection A ('multi') — only te/ta/kn
    // ever need connection B reconnected.
    if (!MANUAL_SWITCH_LANGUAGES.has(language)) return;
    if (language === state.connections.B.language) return; // already correct

    this.logger.log(
      `[DeepGram] Applying preferred language ${language} for ${sessionId} (config-driven, bypassing hysteresis)`,
    );
    await this.switchConnectionB(sessionId, language, activeSession);

    // Reset switch bookkeeping so this config-driven correction never blocks
    // a later real classification-driven switch via the cooldown gate.
    state.lastSwitchAt = 0;
    state.pendingLanguage = null;
    state.pendingConfirmations = 0;
  }

  private async switchConnectionB(
    sessionId: string,
    newLanguage: string,
    activeSession: any,
  ) {
    const state = this.sttState.get(sessionId);
    if (
      !state ||
      state.isSwitchingB ||
      newLanguage === state.connections.B.language
    ) {
      return;
    }
    state.isSwitchingB = true;

    try {
      this.logger.log(
        `[DeepGram] Switching B ${state.connections.B.language} → ${newLanguage} for ${sessionId}`,
      );
      const oldB = state.connections.B;
      const newSocket = await this.createSocket(
        sessionId,
        activeSession,
        newLanguage,
      );
      const newB: ConnectionState = {
        socket: newSocket,
        label: 'B',
        language: newLanguage,
        lastInterimTranscript: '',
        lastInterimLanguage: null,
        dumpSeq: 0,
      };

      this.wireMessageHandlers(sessionId, newB, activeSession);
      // Swap first — feedAudio always sends to state.connections.B fresh on
      // every chunk, so every audio chunk from this point routes correctly.
      state.connections.B = newB;
      state.lastSwitchAt = Date.now();

      try {
        oldB.socket.sendFinalize({ type: 'Finalize' });
      } catch {
        // best effort — proceed to close regardless
      }
      setTimeout(() => {
        try {
          oldB.socket.close();
        } catch {
          // ignore
        }
      }, 1000);
    } catch (err: any) {
      this.logger.error(
        `[DeepGram] Language switch failed: ${err.message || err}`,
      );
    } finally {
      state.isSwitchingB = false;
    }
  }
}
