import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SarvamAIClient } from 'sarvamai';
import type { AudioDriverCallbacks } from '../../services/audio-driver.service';
import { mulawToLinear16 } from '../../helpers/audio.helper';
import { LanguageTracker } from '../../speech/language-tracker';
import {
  speakableLanguages,
  toShortLanguage,
} from '../../speech/language-codes';
import { resolveTtsProvider } from '../../speech/speech.config';
import { PINNED_LANGUAGE } from '../../../common/config/pinned-language';

type SttSocket = Awaited<
  ReturnType<SarvamAIClient['speechToTextStreaming']['connect']>
>;

/** Server messages this service reads — see Sarvam's STT WebSocket reference. */
interface SttMessage {
  type?: 'data' | 'events' | 'error';
  data?: {
    transcript?: string;
    language_code?: string | null;
    language_probability?: string | number | null;
    signal_type?: 'START_SPEECH' | 'END_SPEECH';
  };
}

// The SDK rejects with DOM-style ErrorEvents, not Errors — read .message off either.
const describeError = (err: unknown): string =>
  typeof (err as { message?: unknown })?.message === 'string'
    ? (err as { message: string }).message
    : String(err);

/** The slice of AudioDriverService's per-session state this provider needs. */
export interface SarvamAudioSession {
  encoding: 'LINEAR16' | 'MULAW';
  sampleRateHertz: number;
  callbacks: AudioDriverCallbacks;
}

interface SarvamSttSession {
  socket: SttSocket;
  sampleRate: number;
  encoding: 'LINEAR16' | 'MULAW';
  pending: Buffer[];
  pendingBytes: number;
  tracker: LanguageTracker;
}

// Give up on a connection that hasn't opened by then — the caller falls back.
const OPEN_TIMEOUT_MS = 5000;

// Twilio sends 20 ms frames; batching to ~100 ms keeps the message rate sane
// without adding noticeable latency (Sarvam segments on its own VAD anyway).
const SEND_INTERVAL_SECONDS = 0.1;

/**
 * Streaming STT via Sarvam (saaras). One WebSocket per call with
 * `language-code=unknown`: Sarvam detects the language per utterance across
 * 22 Indian languages, so — unlike the Deepgram path — no second connection
 * or separate audio language classifier is needed.
 *
 * Barge-in fires on Sarvam's START_SPEECH VAD event; each transcript arrives
 * once the speaker pauses (END_SPEECH).
 */
@Injectable()
export class SarvamSttService {
  private readonly logger = new Logger(SarvamSttService.name);
  private readonly sessions = new Map<string, SarvamSttSession>();
  // Preferred languages that arrived while the socket was still opening.
  private readonly pendingLanguages = new Map<string, string>();
  private client: SarvamAIClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Rejects if the socket can't be opened (bad key, network, timeout).
   * `onFailure` fires at most once if Sarvam drops a call that did open —
   * e.g. it closes with 1003 when credits run out — so the caller can hand
   * the rest of the call to another provider. Sarvam isn't reconnected
   * itself: a fallback is quicker than retrying a failing vendor mid-call.
   */
  async openConnection(
    sessionId: string,
    activeSession: SarvamAudioSession,
    onFailure?: (reason: string) => void,
  ): Promise<void> {
    const sampleRate = activeSession.sampleRateHertz;
    const model =
      this.configService.get<string>('SARVAM_STT_MODEL') || 'saaras:v4';
    const mode = this.configService.get<string>('SARVAM_STT_MODE');
    // A pinned language locks Sarvam to it (te-IN) instead of detecting per
    // utterance — far better transcripts for a single-language caller.
    const languageCode = PINNED_LANGUAGE
      ? `${PINNED_LANGUAGE}-IN`
      : this.configService.get<string>('SARVAM_STT_LANGUAGE') || 'unknown';

    const socket = await this.getClient().speechToTextStreaming.connect({
      'language-code': languageCode as never,
      model: model as never,
      ...(mode ? { mode: mode as never } : {}),
      sample_rate: String(sampleRate),
      input_audio_codec: 'pcm_s16le',
      vad_signals: 'true',
      reconnectAttempts: 0,
    });

    const session: SarvamSttSession = {
      socket,
      sampleRate,
      encoding: activeSession.encoding,
      pending: [],
      pendingBytes: 0,
      tracker: this.createTracker(),
    };

    const fail = (reason: string) => {
      // Only a session still registered can fail — closeConnection
      // unregisters first, so our own close never counts.
      if (this.sessions.get(sessionId) !== session) return;
      this.sessions.delete(sessionId);
      this.logger.warn(`[SarvamSTT] ${sessionId} failed: ${reason}`);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      onFailure?.(reason);
    };

    socket.on('message', (message: unknown) =>
      this.handleMessage(
        sessionId,
        session,
        message as SttMessage,
        activeSession.callbacks,
        fail,
      ),
    );
    socket.on('error', (err: unknown) =>
      this.logger.error(
        `[SarvamSTT] ${sessionId} socket error: ${describeError(err)}`,
      ),
    );
    socket.on('close', (event: { code?: number; reason?: string }) => {
      this.logger.log(
        `[SarvamSTT] ${sessionId} closed (${event?.code ?? '?'})`,
      );
      fail(`closed ${event?.code ?? '?'} ${event?.reason ?? ''}`.trim());
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`not open after ${OPEN_TIMEOUT_MS} ms`)),
          OPEN_TIMEOUT_MS,
        );
        socket.waitForOpen().then(
          () => {
            clearTimeout(timer);
            resolve();
          },
          (err: unknown) => {
            clearTimeout(timer);
            reject(err instanceof Error ? err : new Error(describeError(err)));
          },
        );
      });
    } catch (err) {
      try {
        socket.close();
      } catch {
        /* never opened */
      }
      throw err;
    }
    const preferred = this.pendingLanguages.get(sessionId);
    if (preferred) session.tracker.reset(preferred);
    this.pendingLanguages.delete(sessionId);
    this.sessions.set(sessionId, session);
    this.logger.log(
      `[SarvamSTT] Connected ${sessionId} (model=${model}, language=${languageCode}, ${sampleRate} Hz)`,
    );
  }

  feedAudio(sessionId: string, audio: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const pcm = session.encoding === 'MULAW' ? mulawToLinear16(audio) : audio;
    session.pending.push(pcm);
    session.pendingBytes += pcm.length;

    const batchBytes = session.sampleRate * 2 * SEND_INTERVAL_SECONDS;
    if (session.pendingBytes >= batchBytes) this.sendPending(session);
  }

  /** The agent's configured language, known before the caller speaks. */
  setPreferredLanguage(sessionId: string, language: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.tracker.reset(language);
    else this.pendingLanguages.set(sessionId, language);
  }

  closeConnection(sessionId: string): void {
    this.pendingLanguages.delete(sessionId);
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    try {
      session.socket.close();
    } catch (err) {
      this.logger.warn(
        `[SarvamSTT] ${sessionId} close failed: ${describeError(err)}`,
      );
    }
  }

  private sendPending(session: SarvamSttSession): void {
    const audio = Buffer.concat(session.pending);
    session.pending = [];
    session.pendingBytes = 0;
    if (session.socket.readyState !== 1 /* OPEN */) return;
    session.socket.transcribe({
      audio: audio.toString('base64'),
      sample_rate: session.sampleRate,
      encoding: 'audio/wav',
    });
  }

  private handleMessage(
    sessionId: string,
    session: SarvamSttSession,
    message: SttMessage,
    callbacks: AudioDriverCallbacks,
    fail: (reason: string) => void,
  ): void {
    if (message?.type === 'events') {
      if (message.data?.signal_type === 'START_SPEECH') callbacks.onBargeIn();
      return;
    }

    if (message?.type === 'data') {
      const text = String(message.data?.transcript ?? '').trim();
      if (!text) return;
      const probability = Number(message.data?.language_probability ?? NaN);
      const language = session.tracker.observe(
        toShortLanguage(message.data?.language_code),
        Number.isFinite(probability) ? probability : null,
        text,
      );
      this.logger.log(
        `[SarvamSTT] (${message.data?.language_code ?? '?'} → ${language}) ${text}`,
      );
      callbacks.onTranscript(text, language);
      return;
    }

    if (message?.type === 'error') {
      fail(`error ${JSON.stringify(message.data)}`);
    }
  }

  private createTracker(): LanguageTracker {
    const tts = resolveTtsProvider(
      this.configService.get<string>('TTS_PROVIDER'),
      this.configService.get<string>('AI_PROVIDER'),
    );
    return new LanguageTracker({
      initial: PINNED_LANGUAGE ?? 'en',
      supported: speakableLanguages(tts),
      minConfidence:
        Number(
          this.configService.get<string>('LANGUAGE_SWITCH_MIN_CONFIDENCE'),
        ) || 0.8,
      minWords:
        Number(this.configService.get<string>('LANGUAGE_SWITCH_MIN_WORDS')) ||
        2,
    });
  }

  private getClient(): SarvamAIClient {
    this.client ??= new SarvamAIClient({
      apiSubscriptionKey: this.configService.get<string>('SARVAM_API_KEY'),
    });
    return this.client;
  }
}
