import { HttpErrorResponse } from '@angular/common/http';

/** Nest's default error body is `{ statusCode, message, error }`. */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
  }
  return fallback;
}
