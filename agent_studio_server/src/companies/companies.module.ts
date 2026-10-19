import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyDetailsController } from './company-details.controller';

@Module({
  imports: [ReposModule],
  controllers: [CompaniesController, CompanyDetailsController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
