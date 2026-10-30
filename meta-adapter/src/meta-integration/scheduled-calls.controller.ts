import { BadRequestException, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/user.interface';
import { MissedCallRetryService } from './missed-call-retry.service';

/** Queued calls, forwarded by agent_studio_server with the user's JWT. Listing reads the collection there. */
@Controller('scheduled-calls')
@UseGuards(JwtAuthGuard)
export class ScheduledCallsController {
  constructor(private readonly missedCallRetryService: MissedCallRetryService) { }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) throw new BadRequestException('User is not associated with a company');
    return await this.missedCallRetryService.cancelScheduled(id, user.companyId);
  }
}
