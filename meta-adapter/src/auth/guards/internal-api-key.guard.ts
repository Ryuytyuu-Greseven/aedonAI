import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';

/**
 * Guards service-to-service endpoints (e.g. the cron-triggered lead sync).
 * Callers must send `x-internal-api-key` matching INTERNAL_API_KEY; if the
 * env var isn't set, every request is rejected.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_API_KEY;
    const provided = context.switchToHttp().getRequest<Request>().header('x-internal-api-key');

    if (!expected || !provided) throw new UnauthorizedException();

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);

    // timingSafeEqual throws on mismatched lengths, so guard first
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
