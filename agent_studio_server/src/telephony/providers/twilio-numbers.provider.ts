import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';
import {
  AvailableNumber,
  NumberCapabilities,
  PurchasedNumber,
  PurchaseNumberOptions,
  SearchNumbersQuery,
  TelephonyNumbersProvider,
} from '../telephony.types';

/** Twilio error code for "number is no longer available to purchase". */
const TWILIO_NUMBER_UNAVAILABLE = 21422;

interface TwilioRestError {
  status?: number;
  code?: number;
  message?: string;
}

/**
 * Twilio inventory: search AvailablePhoneNumbers, buy/release
 * IncomingPhoneNumbers. Purchased numbers are pointed at the calls gateway's
 * `/twilio/voice` webhook so inbound calls reach the agent immediately.
 */
@Injectable()
export class TwilioNumbersProvider implements TelephonyNumbersProvider {
  readonly name = 'twilio' as const;
  private readonly logger = new Logger(TwilioNumbersProvider.name);
  private client: Twilio.Twilio | null = null;

  constructor(private readonly config: ConfigService) {}

  async search(query: SearchNumbersQuery): Promise<AvailableNumber[]> {
    const country = this.getClient().availablePhoneNumbers(query.isoCountry);
    const options = {
      voiceEnabled: true,
      limit: query.limit,
      ...(query.areaCode ? { areaCode: Number(query.areaCode) } : {}),
      ...(query.contains ? { contains: query.contains } : {}),
    };

    try {
      const results =
        query.type === 'toll_free'
          ? await country.tollFree.list(options)
          : await country.local.list(options);

      return results.map((n) => ({
        provider: this.name,
        e164: n.phoneNumber,
        friendly_name: n.friendlyName,
        iso_country: n.isoCountry,
        number_type: query.type,
        locality: n.locality || null,
        region: n.region || null,
        capabilities: toCapabilities(n.capabilities),
        // Twilio's search doesn't return pricing.
        monthly_price: null,
        currency: null,
      }));
    } catch (error) {
      throw this.toHttpError('search numbers', error);
    }
  }

  async purchase(
    e164: string,
    options: PurchaseNumberOptions,
  ): Promise<PurchasedNumber> {
    const voiceUrl = this.voiceWebhookUrl();
    try {
      const purchased = await this.getClient().incomingPhoneNumbers.create({
        phoneNumber: e164,
        friendlyName: options.friendlyName,
        voiceUrl,
        voiceMethod: 'POST',
        statusCallback: voiceUrl.replace(/\/voice$/, '/status'),
        statusCallbackMethod: 'POST',
      });
      return {
        provider_sid: purchased.sid,
        e164: purchased.phoneNumber,
        friendly_name: purchased.friendlyName,
        capabilities: toCapabilities(purchased.capabilities),
        monthly_price: null,
        currency: null,
        inbound_configured: true,
      };
    } catch (error) {
      if ((error as TwilioRestError).code === TWILIO_NUMBER_UNAVAILABLE) {
        throw new ConflictException(
          `${e164} is no longer available — search again`,
        );
      }
      throw this.toHttpError('purchase number', error);
    }
  }

  async release(providerSid: string): Promise<void> {
    try {
      await this.getClient().incomingPhoneNumbers(providerSid).remove();
    } catch (error) {
      if ((error as TwilioRestError).status === 404) {
        this.logger.warn(`Twilio number ${providerSid} already released`);
        return;
      }
      throw this.toHttpError('release number', error);
    }
  }

  private getClient(): Twilio.Twilio {
    if (this.client) return this.client;
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!accountSid || !authToken) {
      throw new ServiceUnavailableException(
        'Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)',
      );
    }
    this.client = new Twilio.Twilio(accountSid, authToken);
    return this.client;
  }

  /** TWILIO_VOICE_WEBHOOK_URL, else the calls gateway's `/twilio/voice`. */
  private voiceWebhookUrl(): string {
    const explicit = this.config.get<string>('TWILIO_VOICE_WEBHOOK_URL');
    if (explicit) return explicit;
    const gateway = this.config
      .getOrThrow<string>('AUDIO_PROCESSOR_URL')
      .replace(/\/+$/, '');
    return `${gateway}/twilio/voice`;
  }

  private toHttpError(action: string, error: unknown): Error {
    const { status, code, message } = error as TwilioRestError;
    this.logger.error(
      `Twilio failed to ${action}: status=${status} code=${code} ${message}`,
    );
    return new BadGatewayException(
      `Twilio failed to ${action}: ${message ?? 'unknown error'}`,
    );
  }
}

/** Twilio's JSON uses `SMS`/`MMS` keys even though the SDK types say lowercase. */
function toCapabilities(raw: unknown): NumberCapabilities {
  const caps = (raw ?? {}) as Record<string, boolean | undefined>;
  return {
    voice: Boolean(caps.voice ?? caps.Voice),
    sms: Boolean(caps.sms ?? caps.SMS),
    mms: Boolean(caps.mms ?? caps.MMS),
  };
}
