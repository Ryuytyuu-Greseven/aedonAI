import { Module } from '@nestjs/common';
import { AssistantGateway } from './gateways/assistant.gateway';
import { RecordingTesterService } from './recording-tester.service';
import { AssistantService } from './services/assistant.service';
import { AudioDriverService } from './services/audio-driver.service';
import { GeminiService } from './services/gemini.service';
import { OpenAiService } from './services/openai.service';
import { SharedAiService } from './services/shared-ai.service';
import { AgentRouterService } from './services/agent-router.service';
import { LanguageIdService } from './services/language-id.service';
import { VoiceTranslationAdapterService } from './services/voice-translation-adapter.service';
import { McpController } from './mcp.controller';
import { DeepGram } from './stt/deepgram/transcribe';
import { SarvamSttService } from './stt/sarvam/sarvam-stt.service';
import { SarvamTtsService } from './tts/sarvam/sarvam-tts.service';
import { CallLogsModule } from '../call-logs/call-logs.module';
import { AgentsRepository } from 'src/call-logs/repositories/agents.repository';
import { MetaLeadsRepository } from '../call-logs/repositories/meta-leads.repository';
import { ConnectedPagesRepository } from '../call-logs/repositories/connected-pages.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentSchema, Agent } from '../call-logs/schemas/agents.schema';
import {
  MetaLead,
  MetaLeadSchema,
} from '../call-logs/schemas/meta-leads.schema';
import {
  ConnectedPage,
  ConnectedPageSchema,
} from '../call-logs/schemas/connected-pages.schema';

@Module({
  imports: [
    CallLogsModule,
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: MetaLead.name, schema: MetaLeadSchema },
      { name: ConnectedPage.name, schema: ConnectedPageSchema },
    ]),
  ],
  controllers: [McpController],
  providers: [
    AssistantGateway,
    RecordingTesterService,
    AssistantService,
    AudioDriverService,
    GeminiService,
    OpenAiService,
    SharedAiService,
    AgentRouterService,
    LanguageIdService,
    VoiceTranslationAdapterService,
    DeepGram,
    SarvamSttService,
    SarvamTtsService,
    AgentsRepository,
    MetaLeadsRepository,
    ConnectedPagesRepository,
  ],
  exports: [
    AssistantGateway,
    RecordingTesterService,
    AssistantService,
    AudioDriverService,
    GeminiService,
    OpenAiService,
    SharedAiService,
    AgentRouterService,
    LanguageIdService,
    VoiceTranslationAdapterService,
    DeepGram,
    SarvamSttService,
    SarvamTtsService,
    AgentsRepository,
  ],
})
export class AssistantModule {}
