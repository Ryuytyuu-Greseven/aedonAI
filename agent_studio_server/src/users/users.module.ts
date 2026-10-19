import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { ReposModule } from '../repos/repos.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ReposModule, CompaniesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
