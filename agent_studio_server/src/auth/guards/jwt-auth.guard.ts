import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  /**
   * Overridden purely to log *why* a request was rejected (expired token,
   * revoked session, disabled account, etc.) — the response sent back stays
   * a plain 401 Unauthorized either way, so this doesn't leak more detail
   * to the caller than before.
   */
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const request = context.switchToHttp().getRequest<Request>();
      this.logger.warn(
        `[${request.apiTraceId}] Rejected ${request.method} ${request.originalUrl}: ${describeAuthFailure(err, info)}`,
      );
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException();
    }
    return user;
  }
}

function describeAuthFailure(err: unknown, info: unknown): string {
  const source = err ?? info;
  if (source instanceof Error) {
    if (source.name === 'TokenExpiredError') {
      return 'session expired (JWT expired)';
    }
    if (source.name === 'JsonWebTokenError') {
      return `invalid token (${source.message})`;
    }
    return source.message || source.name;
  }
  return 'no token provided';
}
