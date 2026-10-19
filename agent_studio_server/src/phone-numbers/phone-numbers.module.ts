import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { PhoneNumbersController } from './phone-numbers.controller';
import { PhoneNumbersService } from './phone-numbers.service';

@Module({
  imports: [ReposModule],
  controllers: [PhoneNumbersController],
  providers: [PhoneNumbersService],
  exports: [PhoneNumbersService],
})
export class PhoneNumbersModule {}
