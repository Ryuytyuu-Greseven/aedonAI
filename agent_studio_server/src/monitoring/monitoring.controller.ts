import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';

@UseGuards(JwtAuthGuard)
@Controller('agents/:id/calls')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('stats')
  getStats(@Param('id') id: string) {
    return this.monitoringService.getStatsForAgent(id);
  }

  @Get()
  getRecords(@Param('id') id: string) {
    return this.monitoringService.getRecordsForAgent(id);
  }
}
