import { Module } from '@nestjs/common';
import { TelephonyModule } from '../telephony/telephony.module';
import { TwilioService } from './twilio.service';
import { TwilioController } from './controllers/twilio.controller';
import { TwilioGateway } from './gateways/twilio.gateway';

@Module({
  imports: [
    TelephonyModule, // provides CallSessionService
  ],
  controllers: [TwilioController],
  providers: [TwilioService, TwilioGateway],
  exports: [TwilioService],
})
export class TwilioModule {}
