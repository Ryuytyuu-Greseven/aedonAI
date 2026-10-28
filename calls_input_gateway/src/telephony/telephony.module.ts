import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { CallSessionService } from './call-session.service';
import { PendingCallsStore } from './pending-calls.store';
import { LovebytRecordingService } from './recording/lovebyt-recording.service';

/**
 * Carrier-agnostic call plumbing shared by the Twilio and Exotel modules.
 * Outbound routing between carriers lives in OutboundCallsModule, which
 * depends on both carrier modules (and so can't live here).
 */
@Module({
  imports: [
    AssistantModule, // provides AssistantService and AudioDriverService
  ],
  providers: [CallSessionService, PendingCallsStore, LovebytRecordingService],
  exports: [CallSessionService, PendingCallsStore],
})
export class TelephonyModule {}
