import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { PhoneNumbersController } from './phone-numbers.controller';
import { PhoneNumbersService } from './phone-numbers.service';

@Module({
  imports: [ReposModule, TelephonyModule],
  controllers: [PhoneNumbersController],
  providers: [PhoneNumbersService],
  exports: [PhoneNumbersService],
})
export class PhoneNumbersModule {}
