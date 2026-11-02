import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../../twilio/twilio.service';
import { ExotelService } from '../../exotel/exotel.service';
import { isIndianNumber } from '../utils/phone.util';
import {
  OutboundCallRequest,
  OutboundCallResult,
  TelephonyProvider,
} from '../telephony.types';

/**
 * Picks the carrier for an outbound call: an explicit `provider` wins;
 * otherwise Indian numbers go through Exotel (local ExoPhones, lower cost)
 * and everything else through Twilio.
 *
 * The business number (`from`) decides when present — a call must leave from
 * a number the carrier owns, and that number also resolves the Agent. With
 * no `from` (playground previews) the destination decides.
 */
export function resolveOutboundProvider(
  request: Pick<OutboundCallRequest, 'to' | 'from' | 'provider'>,
  exotelEnabled: boolean,
): TelephonyProvider {
  if (request.provider) return request.provider;
  if (!exotelEnabled) return 'twilio';
  return isIndianNumber(request.from || request.to) ? 'exotel' : 'twilio';
}

@Injectable()
export class OutboundCallsService {
  private readonly logger = new Logger(OutboundCallsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly twilioService: TwilioService,
    private readonly exotelService: ExotelService,
  ) {}

  async placeCall(request: OutboundCallRequest): Promise<OutboundCallResult> {
    const provider = resolveOutboundProvider(request, this.exotelEnabled());
    this.logger.log(`Initiating call to ${request.to} via ${provider}`);

    const options = {
      business: request.business,
      voice: request.voice,
      systemInstruction: request.systemInstruction,
      from: request.from,
      channel: request.channel,
    };

    const callSid =
      provider === 'exotel'
        ? await this.exotelService.makeOutboundCall(request.to, {
            ...options,
            agentId: request.agentId,
          })
        : await this.twilioService.makeOutboundCall(request.to, options);

    return { callSid, provider };
  }

  /** EXOTEL_ROUTE_INDIA=false sends Indian numbers back through Twilio. */
  private exotelEnabled(): boolean {
    return (
      this.configService.get<string>('EXOTEL_ROUTE_INDIA') !== 'false' &&
      this.exotelService.isConfigured()
    );
  }
}
