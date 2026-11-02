import {
  CarrierAudioFormat,
  CarrierClient,
} from '../../telephony/telephony.types';
import {
  encodeLinear16ToMulaw,
  resampleLinear16,
  TTS_SAMPLE_RATE,
} from '../../telephony/utils/audio.util';
import { AudioChunker } from '../utils/audio-chunker';

/**
 * Adapts an Exotel Voicebot (bidirectional AgentStream) WebSocket into the
 * generic client shape AssistantService expects — the Exotel counterpart of
 * TwilioClientAdapter:
 *   inlineData audio   → Exotel "media" events, in the call's own format,
 *                        re-sliced into Exotel-sized chunks
 *   interrupted: true  → Exotel "clear" (plus drop our unsent audio)
 *   turnComplete: true → send the reply's buffered tail right away
 *   text / other       → silently dropped (voice-only)
 */
export class ExotelClientAdapter implements CarrierClient {
  public streamSid = '';
  public callSid = '';
  private format: CarrierAudioFormat = {
    encoding: 'LINEAR16',
    sampleRateHertz: 8000,
  };
  private chunker: AudioChunker;

  constructor(private readonly socket: any) {
    this.chunker = this.createChunker();
  }

  get readyState(): number {
    return this.socket.readyState;
  }

  /** Bot audio uses the same format the stream reported for caller audio. */
  setFormat(format: CarrierAudioFormat): void {
    this.format = format;
    this.chunker.clear();
    this.chunker = this.createChunker();
  }

  send(data: string): void {
    if (this.socket.readyState !== 1 /* WebSocket.OPEN */) return;

    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    // ── TTS audio chunk ────────────────────────────────────────────────────
    const parts: any[] = msg.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const linear16 = Buffer.from(part.inlineData.data, 'base64');
        const resampled = resampleLinear16(
          linear16,
          TTS_SAMPLE_RATE,
          this.format.sampleRateHertz,
        );
        this.chunker.push(
          this.format.encoding === 'MULAW'
            ? encodeLinear16ToMulaw(resampled)
            : resampled,
        );
      }
    }

    // ── Barge-in: drop unsent audio and clear Exotel's playback buffer ─────
    if (msg.serverContent?.interrupted) {
      this.chunker.clear();
      this.socket.send(
        JSON.stringify({ event: 'clear', stream_sid: this.streamSid }),
      );
    }

    if (msg.serverContent?.turnComplete) {
      this.chunker.flush();
    }
  }

  /**
   * Ends the call. Exotel has no hangup API for streamed calls — closing the
   * socket ends the Voicebot leg (and the call, for Connect Voice AI calls).
   */
  close(): void {
    this.dispose();
    this.socket.close();
  }

  dispose(): void {
    this.chunker.clear();
  }

  private createChunker(): AudioChunker {
    return new AudioChunker(
      (chunk) => this.sendMedia(chunk),
      this.format.encoding === 'MULAW' ? 0xff : 0x00,
    );
  }

  private sendMedia(chunk: Buffer): void {
    if (this.socket.readyState !== 1 /* WebSocket.OPEN */) return;
    this.socket.send(
      JSON.stringify({
        event: 'media',
        stream_sid: this.streamSid,
        media: { payload: chunk.toString('base64') },
      }),
    );
  }
}
