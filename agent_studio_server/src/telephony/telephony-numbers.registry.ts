import { BadRequestException, Injectable } from '@nestjs/common';
import { ExotelNumbersProvider } from './providers/exotel-numbers.provider';
import { TwilioNumbersProvider } from './providers/twilio-numbers.provider';
import { TELEPHONY_COUNTRIES, TelephonyCountry } from './telephony-countries';
import {
  TelephonyNumbersProvider,
  TelephonyProviderName,
} from './telephony.types';

/** Resolves the provider that sells numbers for a country (US → Twilio, IN → Exotel). */
@Injectable()
export class TelephonyNumbersRegistry {
  private readonly providers: Record<
    TelephonyProviderName,
    TelephonyNumbersProvider
  >;

  constructor(twilio: TwilioNumbersProvider, exotel: ExotelNumbersProvider) {
    this.providers = { twilio, exotel };
  }

  country(isoCountry: string): TelephonyCountry {
    const country = TELEPHONY_COUNTRIES[isoCountry.toUpperCase()];
    if (!country) {
      throw new BadRequestException(
        `Buying numbers is not supported for country ${isoCountry}`,
      );
    }
    return country;
  }

  forCountry(isoCountry: string): TelephonyNumbersProvider {
    return this.providers[this.country(isoCountry).provider];
  }

  byName(name: TelephonyProviderName): TelephonyNumbersProvider {
    return this.providers[name];
  }
}
