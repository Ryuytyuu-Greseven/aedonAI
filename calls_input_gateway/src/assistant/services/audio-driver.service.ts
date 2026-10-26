import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 } from '@google-cloud/speech';
import { DeepGram } from '../stt/deepgram/transcribe';
import { mulawToLinear16 } from '../helpers/audio.helper';
import { SarvamSttService } from '../stt/sarvam/sarvam-stt.service';
import {
  resolveSttFallback,
  resolveSttProvider,
  SttProviderName,
} from '../speech/speech.config';

export interface AudioDriverCallbacks {
  /** language is the STT-detected short code ('en', 'hi', 'te', …). */
  onTranscript: (text: string, language: string) => void;
  /** The caller started speaking; `transcript` is the first interim text when the STT provider has one. */
  onBargeIn: (transcript?: string) => void;
}

export interface AudioSessionConfig {
  /** Google STT encoding. Defaults to LINEAR16 for app clients; set MULAW for Twilio. */
  encoding?: 'LINEAR16' | 'MULAW';
  /** Sample rate in Hz. Defaults to 16000 for LINEAR16; use 8000 for Twilio mulaw. */
  sampleRateHertz?: number;
}

interface AudioSession {
  stream: any | null;
  silenceTimer: NodeJS.Timeout | null;
  speechDetectedByGoogle: boolean;
  callbacks: AudioDriverCallbacks;
  encoding: 'LINEAR16' | 'MULAW';
  sampleRateHertz: number;
  /** Provider actually serving this call — differs from STT_PROVIDER after a fallback. */
  sttProvider: SttProviderName;
  /** Last applyPreferredLanguage value, re-applied if the provider changes. */
  preferredLanguage: string | null;
  /** Audio held while the fallback provider connects; null when not switching. */
  switchBuffer: { chunks: Buffer<ArrayBuffer>[]; bytes: number } | null;
  /** Epoch ms before which caller audio is dropped (see INITIAL_LISTEN_DELAY_MS). */
  listenFrom: number;
  listening: boolean;
  /** Consecutive quiet audio seen since the window ended. */
  quietMs: number;
}

// Caller audio is ignored for this long after a call connects, so the
// agent's greeting isn't cut short by the caller's "hello?" and that early
// speech never becomes a turn. Overridable via INITIAL_LISTEN_DELAY_MS.
const DEFAULT_INITIAL_LISTEN_DELAY_MS = 3500;

// When the window ends mid-sentence, keep ignoring until the caller pauses
// this long, so a sentence begun during the greeting is dropped whole rather
// than its tail becoming a fragment turn ("…in red.") and a barge-in…
const QUIET_BEFORE_LISTEN_MS = 300;
// …but never more than this past the window — steady background noise must
// not leave the agent deaf.
const MAX_SETTLE_MS = 2000;
// RMS (16-bit PCM) below which a chunk counts as quiet. Telephony silence and
// line hiss sit well under this; speech is typically 1000+.
const QUIET_RMS = 400;

function chunkStats(
  audio: Buffer,
  encoding: 'LINEAR16' | 'MULAW',
  sampleRateHertz: number,
): { durationMs: number; rms: number } {
  const pcm = encoding === 'MULAW' ? mulawToLinear16(audio) : audio;
  const samples = Math.floor(pcm.length / 2);
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const v = pcm.readInt16LE(i * 2);
    sumSquares += v * v;
  }
  return {
    durationMs: (samples / sampleRateHertz) * 1000,
    rms: samples ? Math.sqrt(sumSquares / samples) : 0,
  };
}

function parseListenDelay(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_INITIAL_LISTEN_DELAY_MS;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_INITIAL_LISTEN_DELAY_MS;
}

// SDK/socket failures arrive as DOM-style ErrorEvents as well as Errors.
const describeError = (err: unknown): string =>
  typeof (err as { message?: unknown })?.message === 'string'
    ? (err as { message: string }).message
    : String(err);

// Cap on audio held during a provider switch (~5 s of 16 kHz PCM) — Deepgram
// normally connects in under a second.
const MAX_SWITCH_BUFFER_BYTES = 5 * 16000 * 2;

/**
 * AudioDriverService — owns the Google Cloud STT lifecycle per session.
 *
 * Why separate from AssistantService:
 *   AssistantService had silence detection wired to STT data events (interim
 *   transcripts), which means the 1-second timer only reset when Google sent
 *   a result — not when audio chunks actually arrived. If Google didn't send
 *   interim results quickly enough the timer fired with an empty transcript.
 *
 * This service instead:
 *   1. Resets the silence timer on every incoming audio CHUNK (not STT events).
 *   2. On silence (800 ms of no audio), calls stream.end() — this closes the
 *      write side of the gRPC duplex stream and forces Google to emit the
 *      final isFinal:true result for whatever audio it has buffered.
 *   3. Reopens a fresh stream immediately after, ready for the next utterance.
 *   4. Fires onBargeIn() the moment the first audio chunk arrives while the
 *      AI is generating, so TTS can be interrupted immediately.
 */
@Injectable()
export class AudioDriverService {
  private readonly logger = new Logger(AudioDriverService.name);
  private readonly speechClient: v2.SpeechClient;
  private readonly recognizerPath: string;
  private readonly sessions = new Map<string, AudioSession>();

  /** STT_PROVIDER — deepgram (default) | google | sarvam. */
  private readonly STT_SERVICE: SttProviderName;
  /** STT_FALLBACK_PROVIDER — who takes over a failed Sarvam call. */
  private readonly STT_FALLBACK: 'deepgram' | null;
  /** INITIAL_LISTEN_DELAY_MS — caller audio ignored at the start of a call. */
  private readonly INITIAL_LISTEN_DELAY_MS: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly deepgramService: DeepGram,
    private readonly sarvamSttService: SarvamSttService,
  ) {
    this.STT_SERVICE = resolveSttProvider(
      configService.get<string>('STT_PROVIDER'),
    );
    this.STT_FALLBACK = resolveSttFallback(
      configService.get<string>('STT_FALLBACK_PROVIDER'),
    );
    this.INITIAL_LISTEN_DELAY_MS = parseListenDelay(
      configService.get<string>('INITIAL_LISTEN_DELAY_MS'),
    );
    const location =
      configService.get<string>('GOOGLE_CLOUD_LOCATION_IN') || 'global';

    this.speechClient = new v2.SpeechClient({
      apiEndpoint: `${location}-speech.googleapis.com`,
    });

    const projectId = configService.get<string>('GOOGLE_CLOUD_PROJECT') || '';
    const recognizerId =
      configService.get<string>('GOOGLE_CLOUD_STT_RECOGNIZER_ID') || '';
    this.recognizerPath = `projects/${projectId}/locations/${location}/recognizers/${recognizerId}`;

    this.logger.log(
      `[AudioDriver] Initialized. STT provider: ${this.STT_SERVICE}${this.STT_SERVICE === 'sarvam' ? ` (fallback: ${this.STT_FALLBACK ?? 'none'})` : ''}. Recognizer: ${this.recognizerPath}`,
    );
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async startSession(
    sessionId: string,
    callbacks: AudioDriverCallbacks,
    audioConfig?: AudioSessionConfig,
  ) {
    const session: AudioSession = {
      stream: null,
      silenceTimer: null,
      speechDetectedByGoogle: false,
      callbacks,
      encoding: audioConfig?.encoding ?? 'LINEAR16',
      sampleRateHertz: audioConfig?.sampleRateHertz ?? 16000,
      sttProvider: this.STT_SERVICE,
      preferredLanguage: null,
      switchBuffer: null,
      listenFrom: Date.now() + this.INITIAL_LISTEN_DELAY_MS,
      listening: this.INITIAL_LISTEN_DELAY_MS === 0,
      quietMs: 0,
    };
    this.sessions.set(sessionId, session);
    if (this.STT_SERVICE === 'deepgram') {
      await this.deepgramService.openConnection(sessionId, session);
    } else if (this.STT_SERVICE === 'sarvam') {
      await this.openSarvam(sessionId, session);
    } else {
      this.openStream(sessionId, session);
    }
    this.logger.log(`[AudioDriver] Session started: ${sessionId}`);
  }

  /**
   * Config-driven language correction (e.g. the calling business's
   * agent-configured language, resolved before the customer has said
   * anything) — fire-and-forget, same as other STT-switch triggers.
   */
  applyPreferredLanguage(sttKey: string, language: string): void {
    const session = this.sessions.get(sttKey);
    if (session) session.preferredLanguage = language;
    const provider = session?.sttProvider ?? this.STT_SERVICE;
    if (provider === 'sarvam') {
      this.sarvamSttService.setPreferredLanguage(sttKey, language);
      return;
    }
    if (provider !== 'deepgram' || !session) return;
    void this.deepgramService.setPreferredLanguage(sttKey, language, session);
  }

  /**
   * Feed a raw LINEAR16 audio buffer into the STT stream.
   * No barge-in or silence logic here — audio is just piped to Google.
   * All speech detection is driven by Google's transcript events.
   */
  feedAudio(sessionId: string, audio: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Opening window: drop caller audio before any STT provider sees it —
    // nothing said here is transcribed, queued, or treated as a barge-in.
    if (!session.listening) {
      const now = Date.now();
      if (now < session.listenFrom) return;
      const { durationMs, rms } = chunkStats(
        audio as Buffer,
        session.encoding,
        session.sampleRateHertz,
      );
      session.quietMs = rms < QUIET_RMS ? session.quietMs + durationMs : 0;
      const settled =
        session.quietMs >= QUIET_BEFORE_LISTEN_MS ||
        now >= session.listenFrom + MAX_SETTLE_MS;
      if (!settled) return;
      session.listening = true;
      this.logger.log(
        `[AudioDriver] Listening to caller on ${sessionId} (ignored first ${this.INITIAL_LISTEN_DELAY_MS} ms)`,
      );
    }

    if (session.switchBuffer) {
      const buffer = session.switchBuffer;
      const copy = Buffer.from(audio as Buffer);
      buffer.chunks.push(copy);
      buffer.bytes += copy.length;
      while (buffer.bytes > MAX_SWITCH_BUFFER_BYTES && buffer.chunks.length > 1) {
        buffer.bytes -= buffer.chunks.shift()!.length;
      }
      return;
    }

    if (session.sttProvider === 'deepgram') {
      this.deepgramService.feedAudio(sessionId, audio, session);
    } else if (session.sttProvider === 'sarvam') {
      this.sarvamSttService.feedAudio(sessionId, audio);
    } else {
      if (
        session.stream &&
        !session.stream.destroyed &&
        session.stream.writable
      ) {
        try {
          session.stream.write({ audio });
        } catch (err: any) {
          this.logger.error(
            `[AudioDriver] Write error, reopening stream: ${err.message}`,
          );
          this.openStream(sessionId, session);
        }
      }
    }
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.sttProvider === 'deepgram') {
      this.deepgramService.closeConnection(sessionId);
    } else if (session.sttProvider === 'sarvam') {
      this.sarvamSttService.closeConnection(sessionId);
    } else {
      this.clearSilenceTimer(session);
      this.destroyStream(session);
    }
    this.sessions.delete(sessionId);
    this.logger.log(`[AudioDriver] Session ended: ${sessionId}`);
  }

  // ─── Sarvam with Deepgram fallback ────────────────────────────────────────

  /**
   * Opens Sarvam for this call. If it can't connect — or drops later, e.g.
   * credits run out mid-call — the rest of the call moves to the existing
   * Deepgram pipeline instead of going deaf.
   */
  private async openSarvam(
    sessionId: string,
    session: AudioSession,
  ): Promise<void> {
    try {
      await this.sarvamSttService.openConnection(sessionId, session, (reason) =>
        void this.fallBackToDeepgram(sessionId, session, reason),
      );
    } catch (err) {
      await this.fallBackToDeepgram(
        sessionId,
        session,
        `connect failed: ${describeError(err)}`,
      );
    }
  }

  private async fallBackToDeepgram(
    sessionId: string,
    session: AudioSession,
    reason: string,
  ): Promise<void> {
    if (this.sessions.get(sessionId) !== session) return; // call already ended
    if (!this.STT_FALLBACK) {
      this.logger.error(
        `[AudioDriver] Sarvam STT failed for ${sessionId} (${reason}) — no fallback configured`,
      );
      return;
    }
    if (session.sttProvider === 'deepgram') return;

    this.logger.warn(
      `[AudioDriver] Sarvam STT failed for ${sessionId} (${reason}) — falling back to Deepgram`,
    );
    // Stop feeding Sarvam right away and hold the caller's audio until
    // Deepgram is ready, so nothing said during the switch is lost.
    session.sttProvider = 'deepgram';
    session.switchBuffer = { chunks: [], bytes: 0 };
    this.sarvamSttService.closeConnection(sessionId);
    try {
      await this.deepgramService.openConnection(sessionId, session);
    } catch (err) {
      session.switchBuffer = null;
      this.logger.error(
        `[AudioDriver] Deepgram fallback failed for ${sessionId}: ${describeError(err)}`,
      );
      return;
    }
    const held = session.switchBuffer?.chunks ?? [];
    session.switchBuffer = null;
    if (this.sessions.get(sessionId) !== session) {
      // The call ended while Deepgram was connecting.
      this.deepgramService.closeConnection(sessionId);
      return;
    }
    for (const chunk of held) {
      this.deepgramService.feedAudio(sessionId, chunk, session);
    }
    if (session.preferredLanguage) {
      void this.deepgramService.setPreferredLanguage(
        sessionId,
        session.preferredLanguage,
        session,
      );
    }
  }

  // ─── Private stream lifecycle ─────────────────────────────────────────────

  private openStream(sessionId: string, session: AudioSession): void {
    this.destroyStream(session);

    this.logger.log(`[AudioDriver] Opening STT stream for: ${sessionId}`);

    const stream = this.speechClient._streamingRecognize();

    stream.on('data', (response: any) => {
      const result = response?.results?.[0];
      if (!result?.alternatives?.[0]) return;

      const transcript: string = result.alternatives[0].transcript ?? '';
      const isFinal: boolean = result.isFinal ?? false;

      process.stdout.write(
        `\r[STT] ${isFinal ? 'FINAL   ' : 'interim '}: "${transcript}"\n`,
      );

      if (!transcript.trim()) return;

      if (!isFinal) {
        // Google returned an interim transcript → real speech is happening.
        // Fire barge-in ONCE per utterance (not on background noise, not on audio chunks).
        if (!session.speechDetectedByGoogle) {
          session.speechDetectedByGoogle = true;
          session.callbacks.onBargeIn(transcript);
        }
        // Reset the post-speech silence timer so we give Google time to finalize
        this.resetSilenceTimer(sessionId, session);
      } else {
        // isFinal:true — Google is confident the utterance is complete
        this.clearSilenceTimer(session);
        session.speechDetectedByGoogle = false; // ready for next utterance
        session.callbacks.onTranscript(transcript.trim(), 'en');
      }
    });

    stream.on('error', (err: any) => {
      this.logger.error(
        `[AudioDriver] STT stream error: ${err.message || err}`,
      );
      // Brief delay then reopen so we don't spin-loop on persistent errors
      setTimeout(() => {
        if (this.sessions.has(sessionId)) {
          session.speechDetectedByGoogle = false;
          this.openStream(sessionId, session);
        }
      }, 500);
    });

    stream.on('end', () => {
      this.logger.log(
        `[AudioDriver] STT stream closed — reopening for next utterance.`,
      );
      session.speechDetectedByGoogle = false;
      if (this.sessions.has(sessionId)) {
        this.openStream(sessionId, session);
      }
    });

    // First write: send the streaming config (no audio yet)
    stream.write({
      recognizer: this.recognizerPath,
      streamingConfig: {
        config: {
          explicitDecodingConfig: {
            encoding: session.encoding,
            sampleRateHertz: session.sampleRateHertz,
            audioChannelCount: 1,
          },
          languageCodes: ['en-US'],
          model: 'chirp_3',
        },
        streamingFeatures: {
          interimResults: true,
        },
      },
    });

    session.stream = stream;
  }

  /**
   * Started only when Google returns an INTERIM transcript (real speech detected).
   * If Google doesn't send isFinal within 1.5 s of the last interim result,
   * we end the stream to nudge it into finalization. Google's own VAD handles
   * clean cases; this timer is a safety net for slow or noisy finalization.
   */
  private resetSilenceTimer(sessionId: string, session: AudioSession): void {
    this.clearSilenceTimer(session);
    session.silenceTimer = setTimeout(() => {
      session.silenceTimer = null;
      this.logger.log(
        `[AudioDriver] No isFinal after speech — nudging stream.end() to force finalization.`,
      );
      if (session.stream && !session.stream.destroyed) {
        session.stream.end();
      }
    }, 1500);
  }

  private clearSilenceTimer(session: AudioSession): void {
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
      session.silenceTimer = null;
    }
  }

  private destroyStream(session: AudioSession): void {
    if (session.stream) {
      try {
        if (!session.stream.destroyed) {
          session.stream.destroy();
        }
      } catch {
        // ignore destroy errors
      }
      session.stream = null;
    }
  }
}
