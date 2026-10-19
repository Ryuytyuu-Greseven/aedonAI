import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { FrontlineAgentsController } from './frontline-agents.controller';
import { FrontlineAgentsService } from './frontline-agents.service';
import { UsersDirectoryController } from './users-directory.controller';

@Module({
  imports: [ReposModule],
  controllers: [FrontlineAgentsController, UsersDirectoryController],
  providers: [FrontlineAgentsService],
})
export class FrontlineAgentsModule {}
