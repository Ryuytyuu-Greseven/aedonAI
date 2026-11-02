import { Module } from '@nestjs/common';
import { ExotelNumbersProvider } from './providers/exotel-numbers.provider';
import { TwilioNumbersProvider } from './providers/twilio-numbers.provider';
import { TelephonyNumbersRegistry } from './telephony-numbers.registry';

@Module({
  providers: [
    TwilioNumbersProvider,
    ExotelNumbersProvider,
    TelephonyNumbersRegistry,
  ],
  exports: [TelephonyNumbersRegistry],
})
export class TelephonyModule {}
