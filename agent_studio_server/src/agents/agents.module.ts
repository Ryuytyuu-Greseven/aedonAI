import { Module } from '@nestjs/common';
import { TemplatesModule } from '../templates/templates.module';
import { ReposModule } from '../repos/repos.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';

@Module({
  imports: [ReposModule, TemplatesModule],
  controllers: [AgentsController, PreviewController],
  providers: [AgentsService, PreviewService],
  exports: [AgentsService],
})
export class AgentsModule {}
