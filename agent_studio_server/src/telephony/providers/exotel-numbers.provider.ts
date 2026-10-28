import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  AvailableNumber,
  NumberCapabilities,
  PhoneNumberType,
  PurchasedNumber,
  PurchaseNumberOptions,
  SearchNumbersQuery,
  TelephonyNumbersProvider,
} from '../telephony.types';
import { toE164 } from '../utils/e164.util';

// Singapore cluster; Mumbai accounts set EXOTEL_API_HOST=api.in.exotel.com
// (same convention as calls_input_gateway).
const DEFAULT_API_HOST = 'api.exotel.com';

const EXOTEL_NUMBER_TYPES: Partial<Record<PhoneNumberType, string>> = {
  landline: 'Landline',
  mobile: 'Mobile',
  toll_free: 'TollFree',
};

/** Shape of an ExoPhone in v2_beta AvailablePhoneNumbers / IncomingPhoneNumbers responses. */
interface ExotelNumber {
  sid?: string;
  phone_number: string;
  friendly_name?: string;
  capabilities?: { voice?: boolean; sms?: boolean };
  country?: string;
  region?: string;
  number_type?: string;
  rental_price?: string | number;
  currency?: string;
}

/**
 * Exotel inventory over the v2_beta ExoPhones API: search
 * AvailablePhoneNumbers, buy/release IncomingPhoneNumbers.
 *
 * Inbound routing is by flow: purchased numbers get EXOTEL_VOICE_FLOW_URL
 * (an App Bazaar flow streaming to the gateway) as their VoiceUrl when set.
 */
@Injectable()
export class ExotelNumbersProvider implements TelephonyNumbersProvider {
  readonly name = 'exotel' as const;
  private readonly logger = new Logger(ExotelNumbersProvider.name);
  private http: AxiosInstance | null = null;

  constructor(private readonly config: ConfigService) {}

  async search(query: SearchNumbersQuery): Promise<AvailableNumber[]> {
    const exotelType = EXOTEL_NUMBER_TYPES[query.type];
    if (!exotelType) return [];

    try {
      const { data } = await this.getHttp().get<unknown>(
        `/AvailablePhoneNumbers/${query.isoCountry}/${exotelType}`,
        {
          params: {
            ...(query.region ? { InRegion: query.region } : {}),
            ...(query.contains ? { Contains: query.contains } : {}),
          },
        },
      );

      // The API takes no page size, so cap the list here.
      return unwrapList(data)
        .slice(0, query.limit)
        .map((n) => ({
          provider: this.name,
          e164: toE164(n.phone_number, '+91'),
          friendly_name: n.friendly_name ?? n.phone_number,
          iso_country: n.country ?? query.isoCountry,
          number_type: query.type,
          locality: null,
          region: n.region ?? null,
          capabilities: toCapabilities(n.capabilities),
          monthly_price: toPrice(n.rental_price),
          currency: n.currency ?? 'INR',
        }));
    } catch (error) {
      throw this.toHttpError('search numbers', error);
    }
  }

  async purchase(
    e164: string,
    options: PurchaseNumberOptions,
  ): Promise<PurchasedNumber> {
    const voiceUrl = this.config.get<string>('EXOTEL_VOICE_FLOW_URL');
    const body = new URLSearchParams({
      PhoneNumber: e164,
      FriendlyName: options.friendlyName,
      ...(voiceUrl ? { VoiceUrl: voiceUrl } : {}),
    });

    try {
      const { data } = await this.getHttp().post<unknown>(
        '/IncomingPhoneNumbers',
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const purchased = unwrapOne(data);
      if (!purchased?.sid) {
        throw new BadGatewayException(
          'Exotel purchase response did not include an ExoPhone sid',
        );
      }
      if (!voiceUrl) {
        this.logger.warn(
          `ExoPhone ${e164} purchased without a VoiceUrl — set EXOTEL_VOICE_FLOW_URL or assign a flow in the Exotel dashboard`,
        );
      }
      return {
        provider_sid: purchased.sid,
        e164: toE164(purchased.phone_number ?? e164, '+91'),
        friendly_name: purchased.friendly_name ?? options.friendlyName,
        capabilities: toCapabilities(purchased.capabilities),
        monthly_price: toPrice(purchased.rental_price),
        currency: purchased.currency ?? 'INR',
        inbound_configured: Boolean(voiceUrl),
      };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      const status = (error as AxiosError).response?.status;
      if (status && status >= 400 && status < 500) {
        throw new ConflictException(
          `Exotel rejected the purchase of ${e164}: ${providerMessage(error)}`,
        );
      }
      throw this.toHttpError('purchase number', error);
    }
  }

  async release(providerSid: string): Promise<void> {
    try {
      await this.getHttp().delete(`/IncomingPhoneNumbers/${providerSid}`);
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        this.logger.warn(`ExoPhone ${providerSid} already released`);
        return;
      }
      throw this.toHttpError('release number', error);
    }
  }

  private getHttp(): AxiosInstance {
    if (this.http) return this.http;
    const apiKey = this.config.get<string>('EXOTEL_API_KEY');
    const apiToken = this.config.get<string>('EXOTEL_API_TOKEN');
    const accountSid = this.config.get<string>('EXOTEL_ACCOUNT_SID');
    if (!apiKey || !apiToken || !accountSid) {
      throw new ServiceUnavailableException(
        'Exotel is not configured (EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID)',
      );
    }
    const host = this.config.get<string>('EXOTEL_API_HOST') ?? DEFAULT_API_HOST;
    this.http = axios.create({
      baseURL: `https://${host}/v2_beta/Accounts/${accountSid}`,
      auth: { username: apiKey, password: apiToken },
      timeout: 15_000,
    });
    return this.http;
  }

  private toHttpError(action: string, error: unknown): Error {
    const status = (error as AxiosError).response?.status;
    const message = providerMessage(error);
    this.logger.error(`Exotel failed to ${action}: status=${status} ${message}`);
    return new BadGatewayException(`Exotel failed to ${action}: ${message}`);
  }
}

/** v2_beta returns a bare array; tolerate a wrapped `{ AvailablePhoneNumbers: [...] }` too. */
function unwrapList(data: unknown): ExotelNumber[] {
  if (Array.isArray(data)) return data as ExotelNumber[];
  const wrapped = (data ?? {}) as Record<string, unknown>;
  const list =
    wrapped.AvailablePhoneNumbers ?? wrapped.available_phone_numbers ?? [];
  return Array.isArray(list) ? (list as ExotelNumber[]) : [];
}

function unwrapOne(data: unknown): ExotelNumber | null {
  if (!data || typeof data !== 'object') return null;
  const wrapped = data as Record<string, unknown>;
  return (wrapped.IncomingPhoneNumber ?? wrapped) as ExotelNumber;
}

function toCapabilities(raw: ExotelNumber['capabilities']): NumberCapabilities {
  return { voice: Boolean(raw?.voice), sms: Boolean(raw?.sms), mms: false };
}

function toPrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const price = Number(raw);
  return Number.isFinite(price) ? price : null;
}

function providerMessage(error: unknown): string {
  const data = (error as AxiosError).response?.data as
    | { RestException?: { Message?: string }; message?: string }
    | string
    | undefined;
  if (typeof data === 'string' && data) return data;
  if (data && typeof data === 'object') {
    return data.RestException?.Message ?? data.message ?? JSON.stringify(data);
  }
  return (error as Error).message ?? 'unknown error';
}
