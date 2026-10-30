import { Module } from '@nestjs/common';
import { TwilioModule } from '../../twilio/twilio.module';
import { ExotelModule } from '../../exotel/exotel.module';
import { OutboundCallsController } from './outbound-calls.controller';
import { OutboundCallsService } from './outbound-calls.service';

@Module({
  imports: [TwilioModule, ExotelModule],
  controllers: [OutboundCallsController],
  providers: [OutboundCallsService],
})
export class OutboundCallsModule {}
