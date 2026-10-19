import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CommandControlRepository } from '../../repos/command-control.repository';

export interface CommandControlJwtPayload {
  sub: string;
  email: string;
  jti: string;
}

export interface AuthenticatedCommandControlUser {
  userId: string;
  email: string;
}

export const COMMAND_CONTROL_STRATEGY = 'command-control-jwt';

@Injectable()
export class CommandControlJwtStrategy extends PassportStrategy(
  Strategy,
  COMMAND_CONTROL_STRATEGY,
) {
  constructor(
    config: ConfigService,
    private readonly commandControlRepository: CommandControlRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(
    payload: CommandControlJwtPayload,
  ): Promise<AuthenticatedCommandControlUser> {
    const user = await this.commandControlRepository.filterById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    return { userId: user.id as string, email: user.email };
  }
}
