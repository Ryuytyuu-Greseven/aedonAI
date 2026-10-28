import { Injectable, Logger } from '@nestjs/common';
import { AssistantService } from '../assistant/services/assistant.service';
import { AudioDriverService } from '../assistant/services/audio-driver.service';
import { LovebytRecordingService } from './recording/lovebyt-recording.service';
import {
  CallContext,
  CarrierAudioFormat,
  CarrierClient,
} from './telephony.types';

const CALL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const CALL_MODEL = 'models/gemini-3.1-flash-lite';

export interface TelephonyCall {
  client: CarrierClient;
  context: CallContext;
  /** Format of the caller audio the carrier streams in. */
  audio: CarrierAudioFormat;
  /** Ends the phone call — used by the max-duration timer. */
  hangup: () => Promise<void> | void;
}

interface AudioRecord {
  chunks: Buffer[];
  startedAt: number;
}

interface ActiveCall {
  call: TelephonyCall;
  timer: NodeJS.Timeout;
  // lovebyt sessions only
  recording?: AudioRecord;
}

/**
 * Carrier-agnostic lifecycle of one phone call. Carrier gateways (Twilio,
 * Exotel) only translate their wire protocol; once a stream has started they
 * hand the call here, which wires it into the same assistant pipeline:
 *   AssistantService session → AudioDriver STT → agent state + greeting,
 * plus the max-duration hangup and lovebyt recordings.
 */
@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);
  // streamSid → active call
  private readonly calls = new Map<string, ActiveCall>();

  constructor(
    private readonly assistantService: AssistantService,
    private readonly audioDriverService: AudioDriverService,
    private readonly lovebytRecordingService: LovebytRecordingService,
  ) {}

  async start(call: TelephonyCall): Promise<void> {
    const { client, context } = call;
    this.logger.log(
      `[CallSession] Start — provider=${context.provider} streamSid=${client.streamSid} callSid=${client.callSid} business=${context.business} direction=${context.direction}`,
    );

    this.calls.set(client.streamSid, {
      call,
      // Auto-hangup after 2 minutes to protect carrier balance
      timer: this.scheduleHangup(call),
      recording:
        context.business === 'lovebyt'
          ? { chunks: [], startedAt: Date.now() }
          : undefined,
    });

    this.assistantService.initializeSession(client);

    await this.audioDriverService.startSession(
      client.streamSid,
      {
        onTranscript: (text, language) =>
          this.assistantService.onTranscriptReady(client, text, language),
        onBargeIn: (transcript) =>
          this.assistantService.handleBargeIn(client, transcript),
      },
      call.audio,
    );

    await this.assistantService.initiateAgentState(client, {
      model: CALL_MODEL,
      voice: context.voice,
      business: context.business,
      systemInstruction: { parts: [{ text: context.systemInstruction }] },
      provider: context.provider,
      callId: client.callSid,
      direction: context.direction,
      phoneNumber: context.customerNumber,
      agentNumber: context.businessNumber,
      channel: context.channel,
      // Resolved from agentNumber in initiateAgentState when empty.
      agentId: context.agentId ?? '',
    });
  }

  /** Caller audio, in the format declared at start(). */
  feedAudio(streamSid: string, audio: Buffer): void {
    const active = this.calls.get(streamSid);
    if (!active) return;
    this.audioDriverService.feedAudio(streamSid, audio);
    active.recording?.chunks.push(audio);
  }

  /**
   * Tears the call down. Idempotent — carriers send a stop event and then
   * close the socket, and either may arrive first.
   */
  async end(client: CarrierClient): Promise<void> {
    const active = this.calls.get(client.streamSid);
    if (active) {
      this.calls.delete(client.streamSid);
      clearTimeout(active.timer);
      this.audioDriverService.endSession(client.streamSid);
      this.flushRecording(active);
    }
    await this.assistantService.cleanupSession(client);
  }

  private scheduleHangup(call: TelephonyCall): NodeJS.Timeout {
    const { callSid } = call.client;
    return setTimeout(() => {
      this.logger.log(
        `[CallSession] 2-minute limit reached — hanging up ${callSid}`,
      );
      Promise.resolve()
        .then(() => call.hangup())
        .catch((err: any) =>
          this.logger.error(
            `[CallSession] Failed to hang up ${callSid}: ${err?.message ?? err}`,
          ),
        );
    }, CALL_TIMEOUT_MS);
  }

  private flushRecording(active: ActiveCall): void {
    const { recording, call } = active;
    if (!recording) return;
    const streamSid = call.client.streamSid;

    this.lovebytRecordingService
      .saveLovebytRecording(
        streamSid,
        recording.chunks,
        recording.startedAt,
        call.audio,
      )
      .catch((err) =>
        this.logger.error(
          `[CallSession] Failed to save lovebyt recording ${streamSid}:`,
          err,
        ),
      );
  }
}
