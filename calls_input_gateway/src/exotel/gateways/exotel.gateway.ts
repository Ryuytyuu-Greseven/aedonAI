import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { CallSessionService } from '../../telephony/call-session.service';
import { PendingCallsStore } from '../../telephony/pending-calls.store';
import {
  CallContext,
  CarrierAudioFormat,
} from '../../telephony/telephony.types';
import { toE164 } from '../../telephony/utils/phone.util';
import { AgentsRepository } from '../../call-logs/repositories/agents.repository';
import { BusinessDirectoryService } from '../../common/services/business-directory.service';
import { DEFAULT_BUSINESS } from '../../common/config/business-agents.registry';
import { ExotelClientAdapter } from './exotel-client.adapter';

/**
 * ExotelGateway — WebSocket endpoint at /exotel.
 *
 * Exotel AgentStream (Voicebot applet / Connect Voice AI) opens one WebSocket
 * per call and sends (all snake_case):
 *   "connected" — socket is ready
 *   "start"     — stream_sid, call_sid, from, to, custom_parameters, media_format
 *   "media"     — caller audio chunk (base64 raw PCM by default, ~100 ms)
 *   "dtmf"      — keypad digit
 *   "mark"      — a mark we sent has finished playing
 *   "stop"      — stream ended (reason: "stopped" | "callended")
 *
 * Outbound calls (ExotelService) point StreamUrl here; for inbound, set the
 * Voicebot applet's URL in the ExoPhone's App Bazaar flow to wss://…/exotel
 * (optionally with ?business=<template id>).
 * Everything past the wire protocol is handled by CallSessionService.
 */
@WebSocketGateway({ path: '/exotel', cors: true })
export class ExotelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ExotelGateway.name);
  private readonly adapters = new Map<any, ExotelClientAdapter>();

  constructor(
    private readonly callSessionService: CallSessionService,
    private readonly pendingCalls: PendingCallsStore,
    private readonly agentsRepository: AgentsRepository,
    private readonly businessDirectoryService: BusinessDirectoryService,
  ) {}

  handleConnection(socket: any): void {
    this.logger.log('[ExotelGateway] WebSocket connection opened');
    const adapter = new ExotelClientAdapter(socket);
    this.adapters.set(socket, adapter);

    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg: any = JSON.parse(raw.toString());
        this.handleExotelEvent(socket, adapter, msg);
      } catch {
        // ignore malformed frames
      }
    });

    socket.on('error', (err: any) => {
      this.logger.error('[ExotelGateway] Socket error:', err?.message);
    });
  }

  handleDisconnect(socket: any): void {
    const adapter = this.adapters.get(socket);
    if (!adapter) return;

    adapter.dispose();
    void this.callSessionService.end(adapter);
    this.adapters.delete(socket);
    this.logger.log(
      `[ExotelGateway] Disconnected: ${adapter.streamSid || 'unknown'}`,
    );
  }

  // ── Exotel event handler ───────────────────────────────────────────────────

  private handleExotelEvent(
    socket: any,
    adapter: ExotelClientAdapter,
    msg: any,
  ): void {
    switch (msg.event) {
      case 'connected':
        this.logger.log('[ExotelGateway] Stream connected');
        break;

      case 'start':
        void this.onStreamStart(adapter, msg).catch((err) =>
          this.logger.error('[ExotelGateway] Failed to start call:', err),
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

      case 'dtmf':
        this.logger.log(
          `[ExotelGateway] DTMF ${msg.dtmf?.digit} on ${adapter.streamSid}`,
        );
        break;

      case 'stop':
        this.logger.log(
          `[ExotelGateway] Stream stopped: ${adapter.streamSid} (${msg.stop?.reason ?? 'unknown'})`,
        );
        adapter.dispose();
        void this.callSessionService.end(adapter);
        this.adapters.delete(socket);
        break;
    }
  }

  private async onStreamStart(adapter: ExotelClientAdapter, msg: any) {
    const start = msg.start ?? {};
    adapter.streamSid = start.stream_sid ?? msg.stream_sid;
    adapter.callSid = start.call_sid;

    const audio = parseMediaFormat(start.media_format);
    adapter.setFormat(audio);

    const context = await this.resolveContext(adapter.callSid, start);
    this.logger.log(
      `[ExotelGateway] Stream start — streamSid=${adapter.streamSid} callSid=${adapter.callSid} from=${start.from} to=${start.to} audio=${audio.encoding}@${audio.sampleRateHertz}`,
    );

    await this.callSessionService.start({
      client: adapter,
      context,
      audio,
      hangup: () => adapter.close(),
    });
  }

  /**
   * Outbound calls we placed have their context waiting in PendingCallsStore.
   * Anything else is an inbound call to an ExoPhone: the dialled number
   * identifies the business, and its live Agent's template picks the agent
   * server unless the Voicebot URL names one (?business=…).
   */
  private async resolveContext(
    callSid: string,
    start: any,
  ): Promise<CallContext> {
    const from = toE164(start.from);
    const to = toE164(start.to);

    const pending = this.pendingCalls.take('exotel', callSid, [to, from]);
    if (pending) return pending;

    const params: Record<string, string> = start.custom_parameters ?? {};
    const agent = to
      ? await this.agentsRepository.filterByPhoneNumber(to)
      : null;
    const business =
      params.business ??
      agent?.base_template_id ??
      this.businessDirectoryService.resolveBusinessForNumber(to) ??
      DEFAULT_BUSINESS;

    return {
      provider: 'exotel',
      direction: 'inbound',
      business,
      voice: params.voice ?? 'Aoede',
      systemInstruction: '',
      customerNumber: from,
      businessNumber: to,
      channel: params.channel === 'preview' ? 'preview' : undefined,
    };
  }
}

/**
 * The start event reports the stream's audio format. Exotel's default is raw
 * 16-bit PCM; u-law appears only when the applet is configured for it.
 */
function parseMediaFormat(mediaFormat: any): CarrierAudioFormat {
  const encoding = String(mediaFormat?.encoding ?? '').toLowerCase();
  const rate = Number(mediaFormat?.sample_rate);
  return {
    encoding: /mulaw|ulaw/.test(encoding) ? 'MULAW' : 'LINEAR16',
    sampleRateHertz: [8000, 16000, 24000].includes(rate) ? rate : 8000,
  };
}
