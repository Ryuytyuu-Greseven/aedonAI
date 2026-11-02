import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import type {
  OutboundCallRequest,
  OutboundCallResult,
} from '../telephony.types';
import { OutboundCallsService } from './outbound-calls.service';

@Controller()
export class OutboundCallsController {
  private readonly logger = new Logger(OutboundCallsController.name);

  constructor(private readonly outboundCallsService: OutboundCallsService) {}

  /**
   * REST endpoint to trigger an outbound call from your backend.
   * POST /calls  { "to": "+919876543210", "from": "+918047491899", "business": "real_estate_sales" }
   * The carrier is picked per call (see resolveOutboundProvider); pass
   * `provider` to force one. /twilio/call is the original path, kept for
   * agent_studio_server and meta-adapter.
   * Internal only (agent_studio_server previews, meta-adapter lead calls):
   * requires the `x-internal-api-key` header.
   */
  @Post(['calls', 'twilio/call'])
  @UseGuards(InternalApiKeyGuard)
  async placeCall(
    @Body() body: OutboundCallRequest,
  ): Promise<OutboundCallResult> {
    try {
      return await this.outboundCallsService.placeCall(body);
    } catch (error) {
      this.logger.error('Error initiating call:', error);
      throw error;
    }
  }
}
