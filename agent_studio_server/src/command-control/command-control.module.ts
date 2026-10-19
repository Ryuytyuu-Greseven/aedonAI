import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ReposModule } from '../repos/repos.module';
import { CommandControlController } from './command-control.controller';
import { CommandControlService } from './command-control.service';
import { CommandControlJwtStrategy } from './strategies/command-control-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    ReposModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_EXPIRES_IN',
            '1d',
          ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [CommandControlController],
  providers: [CommandControlService, CommandControlJwtStrategy],
})
export class CommandControlModule implements OnModuleInit {
  constructor(private readonly commandControlService: CommandControlService) {}

  async onModuleInit() {
    await this.commandControlService.ensureSeedUser();
  }
}
