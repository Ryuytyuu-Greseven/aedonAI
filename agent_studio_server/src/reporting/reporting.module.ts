import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ReposModule } from '../repos/repos.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [ReposModule, MonitoringModule, AgentsModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
