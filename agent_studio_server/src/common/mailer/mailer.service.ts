import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.from = this.config.getOrThrow<string>('SMTP_FROM');
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<number>('SMTP_PORT', 587) === 465,
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Reset your password',
        text: `We received a request to reset your password. Open this link to choose a new password (expires soon): ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link will expire soon. If you didn't request this, you can ignore this email.</p>`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
