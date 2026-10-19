import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { MailerService } from '../common/mailer/mailer.service';
import { UserRole } from '../common/interfaces/user.interface';
import { hashPassword } from '../common/utils/password.util';
import { UsersRepository } from '../repos/users.repository';
import { RevokedTokensRepository } from '../repos/revoked-tokens.repository';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthSession {
  email: string;
  name: string;
  role: UserRole;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly revokedTokensRepository: RevokedTokensRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.usersRepository.filterByEmail(
      email.toLowerCase().trim(),
    );

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isDisabled) {
      throw new UnauthorizedException('Account is disabled');
    }

    const payload: JwtPayload = {
      sub: user.id as string,
      email: user.email,
      jti: randomUUID(),
      companyId: user.companyId,
    };
    const token = this.jwtService.sign(payload);

    return { email: user.email, name: user.name, role: user.role, token };
  }

  async logout(token: string): Promise<void> {
    const decoded = this.jwtService.decode<JwtPayload & { exp: number }>(token);
    if (!decoded?.jti || !decoded?.exp) {
      return;
    }
    await this.revokedTokensRepository.upsertByJti(
      decoded.jti,
      new Date(decoded.exp * 1000),
    );
  }

  /**
   * Always resolves without revealing whether the email is registered,
   * so this endpoint can't be used to enumerate existing accounts.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.filterByEmail(
      email.toLowerCase().trim(),
    );
    if (!user || user.isDisabled) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const ttlMinutes = this.config.get<number>(
      'RESET_PASSWORD_TOKEN_TTL_MINUTES',
      30,
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.usersRepository.setResetPasswordToken(
      user.id as string,
      tokenHash,
      expiresAt,
    );

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    await this.mailerService.sendPasswordResetEmail(user.email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const user =
      await this.usersRepository.filterByValidResetPasswordTokenHash(tokenHash);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.usersRepository.setPasswordHashAndClearResetToken(
      user.id as string,
      passwordHash,
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async ensureSeedUser(): Promise<void> {
    const email = this.config
      .get<string>('ADMIN_EMAIL', 'test@test.com')
      .toLowerCase()
      .trim();
    const existing = await this.usersRepository.filterByEmail(email);
    if (existing) {
      return;
    }
    const password = this.config.get<string>('ADMIN_PASSWORD', 'admin123');
    const passwordHash = await hashPassword(password);
    await this.usersRepository.create({
      email,
      passwordHash,
      name: 'Admin',
      role: 'admin',
    });
  }
}
