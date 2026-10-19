import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ReposModule } from '../repos/repos.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [ReposModule, AgentsModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
