import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AgentHistory,
  AgentHistorySchema,
} from '../schemas/agent-history.schema';
import { AgentLead, AgentLeadSchema } from '../schemas/agent-leads.schema';
import { Agent, AgentSchema } from '../schemas/agent.schema';
import {
  AgentTemplate,
  AgentTemplateSchema,
} from '../schemas/agent-template.schema';
import { CallLog, CallLogSchema } from '../schemas/call-logs.schema';
import {
  CommandControlUser,
  CommandControlUserSchema,
} from '../schemas/command-control-user.schema';
import { Company, CompanySchema } from '../schemas/company.schema';
import {
  ConnectedPage,
  ConnectedPageSchema,
} from '../schemas/connected-page.schema';
import {
  KnowledgeBase,
  KnowledgeBaseSchema,
} from '../schemas/knowledge-base.schema';
import { LiveAgent, LiveAgentSchema } from '../schemas/live-agent.schema';
import { MetaLead, MetaLeadSchema } from '../schemas/meta-leads.schema';
import { PhoneNumber, PhoneNumberSchema } from '../schemas/phone-number.schema';
import {
  ReportFrequencyPreference,
  ReportFrequencyPreferenceSchema,
} from '../schemas/report-frequency.schema';
import {
  RevokedToken,
  RevokedTokenSchema,
} from '../schemas/revoked-token.schema';
import {
  SalesProperty,
  SalesPropertySchema,
} from '../schemas/sales-property.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { AgentHistoriesRepository } from './agent-histories.repository';
import { AgentLeadsRepository } from './agent-leads.repository';
import { AgentTemplatesRepository } from './agent-templates.repository';
import { AgentsRepository } from './agents.repository';
import { CallRecordsRepository } from './call-records.repository';
import { CommandControlRepository } from './command-control.repository';
import { pineconeIndexFactory } from '../knowledge-bases/embeddings/pinecone.provider';
import { CompaniesRepository } from './companies.repository';
import { ConnectedPagesRepository } from './connected-pages.repository';
import { KnowledgeBaseEmbeddingsRepository } from './knowledge-base-embeddings.repository';
import { KnowledgeBasesRepository } from './knowledge-bases.repository';
import { LiveAgentsRepository } from './live-agents.repository';
import { MetaLeadsRepository } from './meta-leads.repository';
import { PhoneNumbersRepository } from './phone-numbers.repository';
import { ReportFrequencyRepository } from './report-frequency.repository';
import { RevokedTokensRepository } from './revoked-tokens.repository';
import { SalesPropertiesRepository } from './sales-properties.repository';
import { UsersRepository } from './users.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: LiveAgent.name, schema: LiveAgentSchema },
      { name: AgentHistory.name, schema: AgentHistorySchema },
      { name: User.name, schema: UserSchema },
      { name: RevokedToken.name, schema: RevokedTokenSchema },
      { name: AgentTemplate.name, schema: AgentTemplateSchema },
      { name: CallLog.name, schema: CallLogSchema },
      { name: PhoneNumber.name, schema: PhoneNumberSchema },
      { name: KnowledgeBase.name, schema: KnowledgeBaseSchema },
      { name: Company.name, schema: CompanySchema },
      { name: ConnectedPage.name, schema: ConnectedPageSchema },
      { name: MetaLead.name, schema: MetaLeadSchema },
      { name: AgentLead.name, schema: AgentLeadSchema },
      { name: SalesProperty.name, schema: SalesPropertySchema },
      {
        name: CommandControlUser.name,
        schema: CommandControlUserSchema,
      },
      {
        name: ReportFrequencyPreference.name,
        schema: ReportFrequencyPreferenceSchema,
      },
    ]),
  ],
  providers: [
    AgentsRepository,
    LiveAgentsRepository,
    AgentHistoriesRepository,
    UsersRepository,
    RevokedTokensRepository,
    AgentTemplatesRepository,
    CallRecordsRepository,
    PhoneNumbersRepository,
    KnowledgeBasesRepository,
    KnowledgeBaseEmbeddingsRepository,
    pineconeIndexFactory,
    CompaniesRepository,
    ConnectedPagesRepository,
    MetaLeadsRepository,
    AgentLeadsRepository,
    SalesPropertiesRepository,
    CommandControlRepository,
    ReportFrequencyRepository,
  ],
  exports: [
    AgentsRepository,
    LiveAgentsRepository,
    AgentHistoriesRepository,
    UsersRepository,
    RevokedTokensRepository,
    AgentTemplatesRepository,
    CallRecordsRepository,
    PhoneNumbersRepository,
    KnowledgeBasesRepository,
    KnowledgeBaseEmbeddingsRepository,
    CompaniesRepository,
    ConnectedPagesRepository,
    MetaLeadsRepository,
    AgentLeadsRepository,
    SalesPropertiesRepository,
    CommandControlRepository,
    ReportFrequencyRepository,
  ],
})
export class ReposModule {}
