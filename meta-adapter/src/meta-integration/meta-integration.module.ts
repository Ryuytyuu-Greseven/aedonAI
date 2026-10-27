import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';
import { MetaLeadsService } from './meta-leads.service';
import { MetaLeadSyncService } from './meta-lead-sync.service';
import { MetaLeadSyncScheduler } from './meta-lead-sync.scheduler';
import { MetaLeadCallService } from './meta-lead-call.service';
import { MetaLeadCallScheduler } from './meta-lead-call.scheduler';
import { MetaLeadsRepository } from '../repos/meta-leads.repository';
import { ConnectedPagesRepository } from '../repos/connected-pages.repository';
import { AgentsRepository } from '../repos/agents.repository';
import { ConnectedPage, ConnectedPageSchema } from '../schemas/connected-page.schema';
import { MetaLead, MetaLeadSchema } from '../schemas/meta-lead.schema';
import { Agent, AgentSchema } from '../schemas/agent.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConnectedPage.name, schema: ConnectedPageSchema },
      { name: MetaLead.name, schema: MetaLeadSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
  ],
  controllers: [MetaController],
  providers: [
    MetaService,
    MetaLeadsService,
    MetaLeadSyncService,
    MetaLeadSyncScheduler,
    MetaLeadCallService,
    MetaLeadCallScheduler,
    MetaLeadsRepository,
    ConnectedPagesRepository,
    AgentsRepository,
  ],
  exports: [MetaService, MetaLeadsService],
})
export class MetaIntegrationModule {}
