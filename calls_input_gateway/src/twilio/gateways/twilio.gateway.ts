import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { TwilioService } from '../twilio.service';
import { CallSessionService } from '../../telephony/call-session.service';
import {
  CallContext,
  CarrierAudioFormat,
  CarrierClient,
} from '../../telephony/telephony.types';
import {
  encodeLinear16ToMulaw,
  resampleLinear16,
  TTS_SAMPLE_RATE,
} from '../../telephony/utils/audio.util';
import { DEFAULT_BUSINESS } from '../../common/config/business-agents.registry';

// Twilio Media Streams are always G.711 u-law, 8 kHz, mono — both directions.
const TWILIO_AUDIO: CarrierAudioFormat = {
  encoding: 'MULAW',
  sampleRateHertz: 8000,
};

/**
 * Adapts a Twilio Media Streams WebSocket into the shape that AssistantService
 * and AudioDriverService expect from a generic "client".
 *
 * AssistantService calls:
 *   client.readyState  — to guard sends
 *   client.send(json)  — to deliver audio chunks, text, barge-in events
 *
 * This adapter intercepts those sends, translates the protocol, and forwards
 * to the real Twilio WebSocket:
 *   inlineData audio → Twilio "media" event  (after mulaw conversion)
 *   interrupted: true → Twilio "clear" event (clears Twilio's audio buffer)
 *   text / other       → silently dropped    (Twilio is voice-only)
 */
class TwilioClientAdapter implements CarrierClient {
  public streamSid = '';
  public callSid = '';

  constructor(private readonly socket: any) {}

  get readyState(): number {
    return this.socket.readyState;
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
        const mulaw = encodeLinear16ToMulaw(
          resampleLinear16(linear16, TTS_SAMPLE_RATE, TWILIO_AUDIO.sampleRateHertz),
        );
        this.socket.send(
          JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: mulaw.toString('base64') },
          }),
        );
      }
    }

    // ── Barge-in: clear Twilio's audio buffer ─────────────────────────────
    if (msg.serverContent?.interrupted) {
      this.socket.send(
        JSON.stringify({ event: 'clear', streamSid: this.streamSid }),
      );
    }
  }
}

/**
 * TwilioGateway — WebSocket endpoint at /twilio.
 *
 * Twilio Media Streams opens one WebSocket per active call and sends:
 *   "connected"  — stream is ready
 *   "start"      — stream metadata (streamSid, callSid, customParameters)
 *   "media"      — audio chunk (base64 mulaw 8 kHz)
 *   "stop"       — call ended
 *
 * Configure your Twilio number's Voice webhook to POST to /twilio/voice.
 * The controller responds with TwiML that points Stream url="wss://…/twilio".
 * Everything past the wire protocol is handled by CallSessionService.
 */
@WebSocketGateway({ path: '/twilio', cors: true })
export class TwilioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TwilioGateway.name);
  private readonly adapters = new Map<any, TwilioClientAdapter>();

  constructor(
    private readonly callSessionService: CallSessionService,
    private readonly twilioService: TwilioService,
  ) {}

  handleConnection(socket: any): void {
    this.logger.log('[TwilioGateway] WebSocket connection opened');
    const adapter = new TwilioClientAdapter(socket);
    this.adapters.set(socket, adapter);

    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg: any = JSON.parse(raw.toString());
        this.handleTwilioEvent(socket, adapter, msg);
      } catch {
        // ignore malformed frames
      }
    });

    socket.on('error', (err: any) => {
      this.logger.error('[TwilioGateway] Socket error:', err?.message);
    });
  }

  handleDisconnect(socket: any): void {
    const adapter = this.adapters.get(socket);
    if (!adapter) return;

    void this.callSessionService.end(adapter);
    this.adapters.delete(socket);
    this.logger.log(
      `[TwilioGateway] Disconnected: ${adapter.streamSid || 'unknown'}`,
    );
  }

  // ── Twilio event handler ───────────────────────────────────────────────────

  private handleTwilioEvent(
    socket: any,
    adapter: TwilioClientAdapter,
    msg: any,
  ): void {
    switch (msg.event) {
      case 'connected':
        this.logger.log('[TwilioGateway] Stream connected');
        break;

      case 'start':
        void this.onStreamStart(adapter, msg.start).catch((err) =>
          this.logger.error('[TwilioGateway] Failed to start call:', err),
        );
        break;

      case 'media':
        if (msg.media?.payload && adapter.streamSid) {
          this.callSessionService.feedAudio(
            adapter.streamSid,
            Buffer.from(msg.media.payload, 'base64'),
          );
        }
        break;

      case 'stop':
        this.logger.log(`[TwilioGateway] Stream stopped: ${adapter.streamSid}`);
        void this.callSessionService.end(adapter);
        this.adapters.delete(socket);
        break;
    }
  }

  private async onStreamStart(adapter: TwilioClientAdapter, startPayload: any) {
    adapter.streamSid = startPayload.streamSid;
    adapter.callSid = startPayload.callSid;
    // Set by TwilioController.handleVoice as TwiML <Parameter>s.
    const params: Record<string, string> = startPayload.customParameters ?? {};

    const context: CallContext = {
      provider: 'twilio',
      business: params.business ?? DEFAULT_BUSINESS,
      voice: params.voice ?? 'Aoede',
      systemInstruction: params.systemInstruction ?? '',
      direction: params.direction === 'outbound' ? 'outbound' : 'inbound',
      customerNumber: params.customerNumber || undefined,
      businessNumber: params.businessNumber || undefined,
      channel: params.channel === 'preview' ? 'preview' : undefined,
    };

    await this.callSessionService.start({
      client: adapter,
      context,
      audio: TWILIO_AUDIO,
      hangup: () => this.twilioService.endCall(adapter.callSid),
    });
  }
}
