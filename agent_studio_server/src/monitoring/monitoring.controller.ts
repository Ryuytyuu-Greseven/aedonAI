import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { MonitoringService } from './monitoring.service';

@UseGuards(JwtAuthGuard)
@Controller('agents/:id/calls')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // Declared before ':callId' so "stats" / "active" aren't matched as call ids.
  @Get('stats')
  getStats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.monitoringService.getStatsForAgent(id, user.companyId);
  }

  @Get('active')
  getActive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.monitoringService.listActiveCallsForAgent(id, user.companyId);
  }

  @Get()
  getRecords(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.monitoringService.listCallsForAgent(id, user.companyId);
  }

  @Get(':callId')
  getCall(
    @Param('id') id: string,
    @Param('callId') callId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.monitoringService.getCallTranscript(id, callId, user.companyId);
  }
}
