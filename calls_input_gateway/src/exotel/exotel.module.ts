import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { ExotelService } from './exotel.service';
import { ExotelController } from './exotel.controller';
import { ExotelGateway } from './gateways/exotel.gateway';

@Module({
  imports: [
    TelephonyModule, // provides CallSessionService and PendingCallsStore
    AssistantModule, // provides AgentsRepository (inbound business lookup)
  ],
  controllers: [ExotelController],
  providers: [ExotelService, ExotelGateway],
  exports: [ExotelService],
})
export class ExotelModule {}
