import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AssistantModule } from './assistant/assistant.module';
import { TwilioModule } from './twilio/twilio.module';
import { FirebaseModule } from './firebase/firebase.module';
import { CommonModule } from './common/common.module';
import { CallLogsModule } from './call-logs/call-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    CommonModule,
    FirebaseModule,
    AssistantModule,
    TwilioModule,
    CallLogsModule,
  ],
})
export class AppModule {}
