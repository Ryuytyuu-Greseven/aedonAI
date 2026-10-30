import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { DEFAULT_BUSINESS } from '../common/config/business-agents.registry';
import { PendingCallsStore } from '../telephony/pending-calls.store';
import { toE164 } from '../telephony/utils/phone.util';

export interface ExotelOutboundCallOptions {
  business?: string;
  voice?: string;
  systemInstruction?: string;
  /** ExoPhone to call from; EXOTEL_EXOPHONE when empty. */
  from?: string;
  /** 'preview' when placed by the agent_studio playground. */
  channel?: string;
  agentId?: string;
}

// Singapore cluster; Mumbai accounts set EXOTEL_API_HOST=api.in.exotel.com.
const DEFAULT_API_HOST = 'api.exotel.com';
const SUPPORTED_SAMPLE_RATES = [8000, 16000, 24000];

/**
 * Exotel REST client — outbound calls via "Connect Voice AI": one Calls/connect
 * request dials the customer and, once they answer, opens a bidirectional
 * stream to our /exotel WebSocket (ExotelGateway). No App Bazaar flow needed.
 */
@Injectable()
export class ExotelService {
  private readonly logger = new Logger(ExotelService.name);
  private readonly apiKey: string | null;
  private readonly apiToken: string | null;
  private readonly accountSid: string | null;
  private readonly apiHost: string;
  /** Audio rate requested on the stream (`sample-rate` StreamUrl param). */
  readonly sampleRate: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly pendingCalls: PendingCallsStore,
  ) {
    this.apiKey = configService.get<string>('EXOTEL_API_KEY') ?? null;
    this.apiToken = configService.get<string>('EXOTEL_API_TOKEN') ?? null;
    this.accountSid = configService.get<string>('EXOTEL_ACCOUNT_SID') ?? null;
    this.apiHost = (
      configService.get<string>('EXOTEL_API_HOST') ??
      configService.get<string>('EXOTEL_API_BASE_URL') ??
      DEFAULT_API_HOST
    ).replace(/^https?:\/\//, '');

    const rate = Number(configService.get<string>('EXOTEL_SAMPLE_RATE'));
    this.sampleRate = SUPPORTED_SAMPLE_RATES.includes(rate) ? rate : 8000;

    if (this.isConfigured()) {
      this.logger.log(`Exotel client initialized (${this.apiHost}).`);
    } else {
      this.logger.warn(
        'EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID not set — outbound calls disabled.',
      );
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiToken && this.accountSid);
  }

  /**
   * Places an outbound call and parks its context in PendingCallsStore, where
   * ExotelGateway picks it up when the stream starts. Returns the call sid.
   */
  async makeOutboundCall(
    to: string,
    options: ExotelOutboundCallOptions = {},
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Exotel credentials not configured. Check EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_ACCOUNT_SID.',
      );
    }

    const wsBase = this.configService.get<string>('EXOTEL_WS_URL');
    if (!wsBase) throw new Error('EXOTEL_WS_URL not set.');

    const callerId =
      options.from || this.configService.get<string>('EXOTEL_EXOPHONE');
    if (!callerId) {
      throw new Error('No ExoPhone set — configure EXOTEL_EXOPHONE.');
    }

    const customerNumber = toE164(to);
    if (!customerNumber) throw new Error(`Invalid phone number: ${to}`);

    // Call details travel via PendingCallsStore, not stream params — Exotel
    // caps those at 3 / 256 chars and may drop them on outbound calls.
    const streamUrl = `${toWsUrl(wsBase)}/exotel?sample-rate=${this.sampleRate}`;
    const webhookBase =
      this.configService.get<string>('EXOTEL_WEBHOOK_URL') ?? toHttpUrl(wsBase);

    const body = new URLSearchParams({
      From: customerNumber,
      CallerId: callerId,
      StreamUrl: streamUrl,
      StreamType: 'bidirectional',
      StatusCallback: `${webhookBase}/exotel/status`,
      'StatusCallbackEvents[]': 'terminal',
    });

    const url = `https://${this.apiHost}/v1/Accounts/${this.accountSid}/Calls/connect.json`;

    let callSid: string | undefined;
    try {
      const { data } = await axios.post(url, body.toString(), {
        auth: { username: this.apiKey!, password: this.apiToken! },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      callSid = data?.Call?.Sid;
    } catch (error) {
      throw this.toGatewayError(error, customerNumber);
    }
    if (!callSid) {
      throw new BadGatewayException('Exotel accepted the call but returned no Sid');
    }

    this.pendingCalls.save(callSid, {
      provider: 'exotel',
      direction: 'outbound',
      business: options.business ?? DEFAULT_BUSINESS,
      voice: options.voice ?? 'Aoede',
      systemInstruction: options.systemInstruction ?? '',
      customerNumber,
      businessNumber: toE164(callerId),
      channel: options.channel === 'preview' ? 'preview' : undefined,
      agentId: options.agentId || undefined,
    });

    this.logger.log(`Outbound call created: ${callSid} → ${customerNumber}`);
    return callSid;
  }

  /**
   * Exotel answers errors as { RestException: { Status, Message } }. A 403
   * here is usually TRAI NDNC (the number is on India's Do-Not-Disturb list).
   */
  private toGatewayError(error: unknown, to: string): Error {
    if (!(error instanceof AxiosError) || !error.response) {
      this.logger.error(`Exotel request failed for ${to}: ${String(error)}`);
      return error instanceof Error ? error : new Error(String(error));
    }
    const { status, data } = error.response;
    const message: string =
      data?.RestException?.Message ?? error.message ?? 'Unknown Exotel error';
    this.logger.error(`Exotel rejected call to ${to} (${status}): ${message}`);
    return new BadGatewayException({
      message: `Exotel rejected the call: ${message}`,
      status,
    });
  }
}

/** EXOTEL_WS_URL may be configured with an http(s) scheme. */
function toWsUrl(base: string): string {
  return base.replace(/^http(s?):\/\//, 'ws$1://').replace(/\/+$/, '');
}

function toHttpUrl(base: string): string {
  return base.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '');
}
