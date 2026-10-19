import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Assigns a trace id to every incoming request (`req.apiTraceId`) and logs
 * it arriving and resolving (status + duration). Runs before guards/auth,
 * so a request is logged — and gets its trace id — even when it's rejected
 * before reaching a controller (e.g. an expired/invalid JWT); other places
 * that log for a request (JwtAuthGuard, HttpExceptionFilter) read the same
 * `req.apiTraceId` so every log line for one request shares one id.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    req.apiTraceId = randomUUID();
    const { method, originalUrl, apiTraceId } = req;
    const start = Date.now();

    this.logger.log(`[${apiTraceId}] --> ${method} ${originalUrl}`);

    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.log(
        `[${apiTraceId}] <-- ${method} ${originalUrl} ${res.statusCode} ${duration}ms`,
      );
    });

    next();
  }
}
