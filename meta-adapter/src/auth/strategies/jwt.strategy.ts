import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/interfaces/user.interface';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { RevokedTokensRepository } from '../../repos/revoked-tokens.repository';
import { UsersRepository } from '../../repos/users.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly revokedTokensRepository: RevokedTokensRepository,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const revoked = await this.revokedTokensRepository.existsByJti(payload.jti);
    if (revoked) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Looked up live (not read off the payload) so a disable/role change
    // takes effect on the very next request instead of waiting for token expiry.
    const user = await this.usersRepository.filterById(payload.sub);
    if (!user || user.isDisabled) {
      throw new UnauthorizedException('Account is disabled');
    }

    return {
      userId: user.id as string,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };
  }
}
