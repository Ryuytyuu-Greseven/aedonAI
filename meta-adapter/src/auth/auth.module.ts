import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ReposModule } from '../repos/repos.module';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Verification-only auth module: meta-adapter never issues JWTs (that's
 * lyreai_agent_builder_server's job), it only verifies the ones users already
 * hold, using the same JWT_SECRET and a shared read-only view of `users` /
 * `revoked_tokens`.
 */
@Module({
  imports: [PassportModule, ReposModule],
  providers: [JwtStrategy],
})
export class AuthModule {}
