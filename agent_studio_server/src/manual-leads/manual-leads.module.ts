import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ReposModule } from '../repos/repos.module';
import { ManualLeadsController } from './manual-leads.controller';
import { ManualLeadsService } from './manual-leads.service';

@Module({
  imports: [ReposModule, AgentsModule, IntegrationsModule],
  controllers: [ManualLeadsController],
  providers: [ManualLeadsService],
})
export class ManualLeadsModule {}
