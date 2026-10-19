import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { MetaIntegrationsController } from './meta/meta-integrations.controller';
import { MetaIntegrationsService } from './meta/meta-integrations.service';

@Module({
  imports: [ReposModule],
  controllers: [MetaIntegrationsController],
  providers: [MetaIntegrationsService],
})
export class IntegrationsModule {}
