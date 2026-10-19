import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallLogsController } from './controllers/call-logs.controller';
import { CallLogService } from './services/call-log.service';
import { CallLogRepository } from './repositories/call-log.repository';
import { CallLog, CallLogSchema } from './schemas/call-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CallLog.name, schema: CallLogSchema }]),
  ],
  controllers: [CallLogsController],
  providers: [CallLogService, CallLogRepository],
  exports: [CallLogService],
})
export class CallLogsModule {}
