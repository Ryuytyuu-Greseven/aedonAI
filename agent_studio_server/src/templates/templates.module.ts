import { Module, OnModuleInit } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [ReposModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule implements OnModuleInit {
  constructor(private readonly templatesService: TemplatesService) { }

  async onModuleInit() {
    // await this.templatesService.seed();
  }
}
