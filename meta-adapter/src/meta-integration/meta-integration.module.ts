import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';
import { MetaLeadsService } from './meta-leads.service';
import { MetaLeadSyncService } from './meta-lead-sync.service';
import { MetaLeadSyncScheduler } from './meta-lead-sync.scheduler';
import { MetaLeadCallService } from './meta-lead-call.service';
import { MetaLeadCallScheduler } from './meta-lead-call.scheduler';
import { ManualLeadCallService } from './manual-lead-call.service';
import { ManualLeadsController } from './manual-leads.controller';
import { CallsGatewayClient } from './calls-gateway.client';
import { CallsController } from './calls.controller';
import { ScheduledCallsController } from './scheduled-calls.controller';
import { MissedCallRetryService } from './missed-call-retry.service';
import { MetaLeadsRepository } from '../repos/meta-leads.repository';
import { ConnectedPagesRepository } from '../repos/connected-pages.repository';
import { AgentsRepository } from '../repos/agents.repository';
import { AgentLeadsRepository } from '../repos/agent-leads.repository';
import { ScheduledCallsRepository } from '../repos/scheduled-calls.repository';
import { ConnectedPage, ConnectedPageSchema } from '../schemas/connected-page.schema';
import { MetaLead, MetaLeadSchema } from '../schemas/meta-lead.schema';
import { Agent, AgentSchema } from '../schemas/agent.schema';
import { AgentLead, AgentLeadSchema } from '../schemas/agent-lead.schema';
import { ScheduledCall, ScheduledCallSchema } from '../schemas/scheduled-call.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConnectedPage.name, schema: ConnectedPageSchema },
      { name: MetaLead.name, schema: MetaLeadSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: AgentLead.name, schema: AgentLeadSchema },
      { name: ScheduledCall.name, schema: ScheduledCallSchema },
    ]),
  ],
  controllers: [MetaController, ManualLeadsController, CallsController, ScheduledCallsController],
  providers: [
    MetaService,
    MetaLeadsService,
    MetaLeadSyncService,
    MetaLeadSyncScheduler,
    MetaLeadCallService,
    MetaLeadCallScheduler,
    ManualLeadCallService,
    CallsGatewayClient,
    MissedCallRetryService,
    MetaLeadsRepository,
    ConnectedPagesRepository,
    AgentsRepository,
    AgentLeadsRepository,
    ScheduledCallsRepository,
  ],
  exports: [MetaService, MetaLeadsService],
})
export class MetaIntegrationModule {}
