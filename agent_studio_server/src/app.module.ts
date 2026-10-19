import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { TemplatesModule } from './templates/templates.module';
import { AgentsModule } from './agents/agents.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ReportingModule } from './reporting/reporting.module';
import { PhoneNumbersModule } from './phone-numbers/phone-numbers.module';
import { KnowledgeBasesModule } from './knowledge-bases/knowledge-bases.module';
import { FrontlineAgentsModule } from './frontline-agents/frontline-agents.module';
import { CompaniesModule } from './companies/companies.module';
import { CommandControlModule } from './command-control/command-control.module';
import { UsersModule } from './users/users.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    TemplatesModule,
    AgentsModule,
    MonitoringModule,
    ReportingModule,
    PhoneNumbersModule,
    KnowledgeBasesModule,
    FrontlineAgentsModule,
    CompaniesModule,
    CommandControlModule,
    UsersModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
