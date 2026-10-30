import { Body, Controller, Logger, Post } from '@nestjs/common';
import { PendingCallsStore } from '../telephony/pending-calls.store';

/**
 * Exotel webhooks. Outbound calls are placed by OutboundCallsController
 * (POST /calls, or the legacy POST /twilio/call), which picks the carrier.
 */
@Controller('exotel')
export class ExotelController {
  private readonly logger = new Logger(ExotelController.name);

  constructor(private readonly pendingCalls: PendingCallsStore) {}

  /**
   * Status callback for calls placed by ExotelService (StatusCallback with
   * terminal events): completed, failed, busy, no-answer.
   */
  @Post('status')
  handleStatus(@Body() body: any): { received: boolean } {
    const callSid: string | undefined = body?.CallSid;
    this.logger.log(
      `[Status Callback] CallSid=${callSid} Status=${body?.Status} Duration=${body?.ConversationDuration ?? body?.Duration ?? '-'}`,
    );
    // A call that never connected won't stream, so its context is dead weight.
    if (callSid) this.pendingCalls.discard('exotel', callSid);
    return { received: true };
  }
}
