import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ReposModule } from '../repos/repos.module';
import { ScheduledCallsController } from './scheduled-calls.controller';
import { ScheduledCallsService } from './scheduled-calls.service';

@Module({
  imports: [ReposModule, AgentsModule, IntegrationsModule],
  controllers: [ScheduledCallsController],
  providers: [ScheduledCallsService],
})
export class ScheduledCallsModule {}
