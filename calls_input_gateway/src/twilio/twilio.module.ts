import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { TwilioService } from './twilio.service';
import { TwilioController } from './controllers/twilio.controller';
import { TwilioGateway } from './gateways/twilio.gateway';
import { LobsterRecordingService } from './gateways/lobster-recording.service';
import { ExotelService } from '../exotel/exotel.service';

@Module({
  imports: [
    AssistantModule, // provides AssistantService and AudioDriverService
  ],
  controllers: [TwilioController],
  providers: [
    TwilioService,
    TwilioGateway,
    LobsterRecordingService,
    ExotelService,
  ],
  exports: [TwilioService],
})
export class TwilioModule {}
