import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { ListScheduledCallsQueryDto } from './dto/list-scheduled-calls-query.dto';
import { ScheduledCallsService } from './scheduled-calls.service';

/** Calls queued by the dialer for one agent (missed-call retries for now). */
@UseGuards(JwtAuthGuard)
@Controller('agents/:id/scheduled-calls')
export class ScheduledCallsController {
  constructor(private readonly scheduledCallsService: ScheduledCallsService) {}

  @Get()
  list(
    @Param('id') id: string,
    @Query() query: ListScheduledCallsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.scheduledCallsService.list(id, user.companyId, query);
  }

  /** Forwarded to meta-adapter with the caller's JWT. */
  @Post(':scheduledCallId/cancel')
  cancel(
    @Param('id') id: string,
    @Param('scheduledCallId') scheduledCallId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.scheduledCallsService.cancel(
      id,
      scheduledCallId,
      user.companyId,
      req.headers.authorization ?? '',
    );
  }
}
