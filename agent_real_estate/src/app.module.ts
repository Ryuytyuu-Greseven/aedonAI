import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AgentModule,
  ],
})
export class AppModule {}
