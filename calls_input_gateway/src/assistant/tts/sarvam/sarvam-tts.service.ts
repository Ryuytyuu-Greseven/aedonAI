import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SarvamAIClient } from 'sarvamai';
import { normalizeNumbersForSpeech } from '../../helpers/tts-text.helper';
import { toSarvamTtsLanguage } from '../../speech/language-codes';
import { resolveVoice } from '../../speech/voices/voice-mapper';
import { splitIntoSentences } from '../sentence-chunker';

type TtsSocket = Awaited<
  ReturnType<SarvamAIClient['textToSpeechStreaming']['connect']>
>;

/** Server messages this service reads — see Sarvam's TTS WebSocket reference. */
interface TtsMessage {
  type?: 'audio' | 'event' | 'error';
  data?: {
    audio?: string;
    event_type?: string;
    message?: string;
    code?: number;
  };
}

/** The slice of AssistantService's SessionState a TTS turn touches. */
interface TtsTurnSession {
  isGenerating: boolean;
  language: string;
  abortTts?: (() => void) | null;
}

const describeError = (err: unknown): string =>
  err instanceof Error ? (err.stack ?? err.message) : String(err);

// Matches the rest of the pipeline: the browser plays 24 kHz PCM and
// the phone adapters resample 24 kHz to their carrier format (TTS_SAMPLE_RATE).
const OUTPUT_SAMPLE_RATE = 24000;

// Upper bound on waiting for the last sentence's audio after the reply text
// is exhausted — a dropped `final` event must not hang the turn.
const FINAL_EVENT_TIMEOUT_MS = 8000;

const CONNECT_ATTEMPTS = 2;

/**
 * Streaming TTS via Sarvam (bulbul). One WebSocket per agent turn, opened as
 * soon as the reply starts streaming so the handshake overlaps generation.
 * Each sentence is sent and flushed immediately; Sarvam answers every flush
 * with its audio followed by one `final` event, which is how the turn knows
 * all audio has arrived.
 *
 * Same contract as GeminiService.textToSpeech: text parts go out ahead of
 * their audio, audio is base64 LINEAR16 @ 24 kHz, and session.abortTts stops
 * it on barge-in.
 */
@Injectable()
export class SarvamTtsService {
  private readonly logger = new Logger(SarvamTtsService.name);
  private client: SarvamAIClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  public async textToSpeech(
    llmStream: AsyncIterable<{ text?: string }>,
    voice: string,
    onAudioChunk: (base64Audio: string, text: string, client: unknown) => void,
    session: TtsTurnSession,
    client: unknown,
  ): Promise<void> {
    const model =
      this.configService.get<string>('SARVAM_TTS_MODEL') || 'bulbul:v3';
    // `voice` is the agent's provider-neutral voice code (female_1, …).
    const speaker = resolveVoice('sarvam', voice);
    const pace = Number(this.configService.get<string>('SARVAM_TTS_PACE')) || 1;
    const temperatureRaw = this.configService.get<string>('SARVAM_TTS_TEMPERATURE');
    const temperature =
      temperatureRaw !== undefined && !isNaN(Number(temperatureRaw))
        ? Number(temperatureRaw)
        : 0.2;
    const languageCode = toSarvamTtsLanguage(session.language);
    this.logger.log(
      `[SarvamTTS] ${model}/${speaker} in ${languageCode} (agent voice "${voice}", pace=${pace}, temp=${temperature})`,
    );

    let socket: TtsSocket | null = null;
    let opening: Promise<TtsSocket | null> | null = null;
    let aborted = false;
    let flushes = 0;
    let finals = 0;
    let carry: Buffer | null = null;
    let onAllFinal: (() => void) | null = null;

    const settle = () => {
      if (finals >= flushes) onAllFinal?.();
    };

    const handleMessage = (message: TtsMessage) => {
      if (message?.type === 'audio') {
        if (!session.isGenerating || aborted) return;
        let audio = Buffer.from(message.data?.audio ?? '', 'base64');
        // Keep whole 16-bit samples per chunk — downstream reads Int16 pairs.
        if (carry) audio = Buffer.concat([carry, audio]);
        carry = audio.length % 2 ? audio.subarray(audio.length - 1) : null;
        if (carry) audio = audio.subarray(0, audio.length - 1);
        if (audio.length) onAudioChunk(audio.toString('base64'), '', client);
        return;
      }
      if (message?.type === 'event' && message.data?.event_type === 'final') {
        finals++;
        settle();
        return;
      }
      if (message?.type === 'error') {
        this.logger.error(`[SarvamTTS] error: ${JSON.stringify(message.data)}`);
        finals = flushes; // nothing more is coming for what was sent
        settle();
      }
    };

    const connectOnce = async (): Promise<TtsSocket | null> => {
      const s = await this.getClient().textToSpeechStreaming.connect({
        model: model as never,
        send_completion_event: 'true',
        reconnectAttempts: 0,
      });
      s.on('message', (message: unknown) =>
        handleMessage(message as TtsMessage),
      );
      s.on('error', (err: unknown) =>
        this.logger.error(`[SarvamTTS] socket error: ${describeError(err)}`),
      );
      try {
        await s.waitForOpen();
      } catch (err) {
        s.close();
        throw err;
      }
      // Only a socket that actually opened may end the turn's wait on close.
      s.on('close', () => {
        finals = flushes;
        settle();
      });
      if (aborted) {
        s.close();
        return null;
      }
      s.configureConnection({
        type: 'config',
        data: {
          language_code: languageCode,
          speaker,
          pace,
          temperature,
          speech_sample_rate: OUTPUT_SAMPLE_RATE,
          enable_preprocessing: true,
          output_audio_codec: 'linear16',
        } as never,
      });
      socket = s;
      return s;
    };

    // A failed handshake would leave the whole reply silent, so a transient
    // blip (the SDK gives the socket 4 s to open) gets one more try.
    const open = (): Promise<TtsSocket | null> => {
      opening ??= (async () => {
        for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
          try {
            return await connectOnce();
          } catch (err) {
            const retrying =
              attempt < CONNECT_ATTEMPTS && !aborted && session.isGenerating;
            this.logger.error(
              `[SarvamTTS] connect failed (attempt ${attempt}/${CONNECT_ATTEMPTS}${retrying ? ', retrying' : ''}): ${describeError(err)}`,
            );
            if (!retrying) return null;
          }
        }
        return null;
      })();
      return opening;
    };

    const speak = async (sentence: string): Promise<void> => {
      if (!session.isGenerating) return;
      onAudioChunk('', sentence + ' ', client);
      const s = await open();
      if (!s || aborted || !session.isGenerating) return;
      s.convert(normalizeNumbersForSpeech(sentence));
      s.flush();
      flushes++;
    };

    session.abortTts = () => {
      aborted = true;
      socket?.close();
      onAllFinal?.();
    };

    try {
      for await (const sentence of splitIntoSentences(
        llmStream,
        () => session.isGenerating,
        () => void open(),
      )) {
        await speak(sentence);
      }
    } catch (err) {
      this.logger.error(
        `[SarvamTTS] Error in LLM stream to TTS loop: ${describeError(err)}`,
      );
    } finally {
      // Hold the turn open until the last flushed sentence's audio is in —
      // the caller flips isGenerating off as soon as this returns, which
      // would drop late chunks (same reason GeminiService waits for 'end').
      // abortTts stays armed meanwhile so a barge-in ends the wait at once.
      if (!aborted && session.isGenerating && finals < flushes) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, FINAL_EVENT_TIMEOUT_MS);
          onAllFinal = () => {
            clearTimeout(timer);
            resolve();
          };
          settle();
        });
      }
      session.abortTts = null;
      // Assigned inside closures, so TS narrows these to their initial null.
      const pending = opening as Promise<TtsSocket | null> | null;
      const s =
        (socket as TtsSocket | null) ?? (pending ? await pending : null);
      s?.close();
    }
  }

  private getClient(): SarvamAIClient {
    this.client ??= new SarvamAIClient({
      apiSubscriptionKey: this.configService.get<string>('SARVAM_API_KEY'),
    });
    return this.client;
  }
}
