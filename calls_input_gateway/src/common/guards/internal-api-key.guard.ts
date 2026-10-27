import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Request } from 'express';

/**
 * Guards endpoints that only our own services may call (e.g. POST
 * /twilio/call, which makes the Twilio account dial any number). The
 * gateway has to stay publicly reachable for Twilio's webhooks and media
 * WebSocket, so these routes can't rely on network isolation alone.
 *
 * Callers send `x-internal-api-key` matching INTERNAL_API_KEY; if the env
 * var isn't set, every request is rejected.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('INTERNAL_API_KEY');
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-internal-api-key');

    if (!expected) {
      this.logger.error(
        `INTERNAL_API_KEY not set — rejecting ${request.method} ${request.path}`,
      );
      throw new UnauthorizedException();
    }

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided ?? '');

    // timingSafeEqual throws on mismatched lengths, so guard first
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      this.logger.warn(
        `Rejected ${request.method} ${request.path} from ${request.ip}: invalid internal API key`,
      );
      throw new UnauthorizedException();
    }
    return true;
  }
}
