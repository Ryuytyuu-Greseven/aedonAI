import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AssistantService } from '../../assistant/services/assistant.service';
import { AudioDriverService } from '../../assistant/services/audio-driver.service';
import { TwilioService } from '../twilio.service';
import { convertTtsForTwilio } from '../utils/audio.util';
import { LovebytRecordingService } from './lovebyt-recording.service';
import { DEFAULT_BUSINESS } from '../../common/config/business-agents.registry';

const CALL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Placeholder agent-invocation id for telephony calls (Twilio/Exotel).
 * Neither provider carries a real per-call agent invocation id yet — swap
 * this for the real value once that's wired up.
 */
const TELEPHONY_AGENT_ID = 'replace_me_later';

interface AudioRecord {
  chunks: Buffer[];
  startedAt: number;
}

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
class TwilioClientAdapter {
  public streamSid = '';
  public callSid = '';

  constructor(private readonly socket: any) { }

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
        const mulaw = convertTtsForTwilio(linear16);
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
 */
@WebSocketGateway({ path: '/twilio', cors: true })
export class TwilioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TwilioGateway.name);
  private readonly adapters = new Map<any, TwilioClientAdapter>();
  // streamSid → accumulated audio (lovebyt sessions only)
  private readonly recordings = new Map<string, AudioRecord>();
  // streamSid → auto-hangup timer handle
  private readonly callTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly assistantService: AssistantService,
    private readonly audioDriverService: AudioDriverService,
    private readonly twilioService: TwilioService,
    private readonly lovebytRecordingService: LovebytRecordingService,
  ) { }

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

    if (adapter.streamSid) {
      this.clearCallTimer(adapter.streamSid);
      this.audioDriverService.endSession(adapter.streamSid);
      this.flushRecording(adapter.streamSid);
    }
    void this.assistantService.cleanupSession(adapter);
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
        this.onStreamStart(adapter, msg.start);
        break;

      case 'media':
        if (msg.media?.payload && adapter.streamSid) {
          const audio = Buffer.from(msg.media.payload, 'base64');
          this.audioDriverService.feedAudio(adapter.streamSid, audio);
          this.recordings.get(adapter.streamSid)?.chunks.push(audio);
        }
        break;

      case 'stop':
        this.logger.log(`[TwilioGateway] Stream stopped: ${adapter.streamSid}`);
        if (adapter.streamSid) {
          this.clearCallTimer(adapter.streamSid);
          this.audioDriverService.endSession(adapter.streamSid);
          this.flushRecording(adapter.streamSid);
        }
        void this.assistantService.cleanupSession(adapter);
        this.adapters.delete(socket);
        break;
    }
  }

  private async onStreamStart(adapter: TwilioClientAdapter, startPayload: any) {
    // Twilio's 'start' event uses camelCase (streamSid/callSid/customParameters);
    // Exotel's uses snake_case (stream_sid/call_sid/custom_parameters) — both
    // providers share this gateway, so both shapes must be handled.
    adapter.streamSid = startPayload.streamSid ?? startPayload.stream_sid;
    adapter.callSid = startPayload.callSid ?? startPayload.call_sid;
    const params: Record<string, string> =
      startPayload.customParameters ?? startPayload.custom_parameters ?? {};

    const business = params.business ?? DEFAULT_BUSINESS;
    const voice = params.voice ?? 'Aoede';
    const systemInstruction = params.systemInstruction ?? '';
    const provider = params.provider === 'exotel' ? 'exotel' : 'twilio';
    const direction = params.direction === 'outbound' ? 'outbound' : 'inbound';
    const phoneNumber = params.customerNumber || undefined;
    const agentNumber = params.businessNumber || undefined;
    const channel = params.channel === 'preview' ? 'preview' : undefined;

    this.logger.log(
      `[TwilioGateway] Stream start — streamSid=${adapter.streamSid} callSid=${adapter.callSid} business=${business} provider=${provider} direction=${direction}`,
    );

    if (business === 'lovebyt') {
      this.recordings.set(adapter.streamSid, {
        chunks: [],
        startedAt: Date.now(),
      });
    }

    // Auto-hangup after 2 minutes to protect Twilio balance
    this.scheduleHangup(adapter.streamSid, adapter.callSid);

    this.assistantService.initializeSession(adapter);

    await this.audioDriverService.startSession(
      adapter.streamSid,
      {
        onTranscript: (text, language) =>
          this.assistantService.onTranscriptReady(adapter, text, language),
        onBargeIn: () => this.assistantService.handleBargeIn(adapter),
      },
      { encoding: 'MULAW', sampleRateHertz: 8000 },
    );

    await this.assistantService.initiateAgentState(adapter, {
      model: 'models/gemini-3.1-flash-lite',
      voice,
      business,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      provider,
      callId: adapter.callSid,
      direction,
      phoneNumber,
      agentNumber,
      channel,
      agentId: TELEPHONY_AGENT_ID,
    });
  }

  private scheduleHangup(streamSid: string, callSid: string): void {
    const timer = setTimeout(() => {
      this.logger.log(
        `[TwilioGateway] 2-minute limit reached — hanging up ${callSid}`,
      );
      this.callTimers.delete(streamSid);
      try {
        void this.twilioService.endCall(callSid);
      } catch (err: any) {
        this.logger.error(
          `[TwilioGateway] Failed to hang up ${callSid}: ${err.message}`,
        );
      }
    }, CALL_TIMEOUT_MS);

    this.callTimers.set(streamSid, timer);
  }

  private clearCallTimer(streamSid: string): void {
    const timer = this.callTimers.get(streamSid);
    if (timer) {
      clearTimeout(timer);
      this.callTimers.delete(streamSid);
    }
  }

  private flushRecording(streamSid: string): void {
    const record = this.recordings.get(streamSid);
    if (!record) return;
    this.recordings.delete(streamSid);

    this.lovebytRecordingService
      .saveLovebytRecording(streamSid, record.chunks, record.startedAt)
      .catch((err) =>
        this.logger.error(
          `[TwilioGateway] Failed to save lovebyt recording ${streamSid}:`,
          err,
        ),
      );
  }
}
