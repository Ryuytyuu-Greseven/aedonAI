import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';
import { CallOutcomeDto } from './dto/call-outcome.dto';
import { MissedCallRetryService } from './missed-call-retry.service';

/** Call lifecycle events from calls_input_gateway (service-to-service only). */
@Controller('calls')
@UseGuards(InternalApiKeyGuard)
export class CallsController {
  constructor(private readonly missedCallRetryService: MissedCallRetryService) { }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  async status(@Body() dto: CallOutcomeDto) {
    return await this.missedCallRetryService.handleOutcome(dto);
  }
}
