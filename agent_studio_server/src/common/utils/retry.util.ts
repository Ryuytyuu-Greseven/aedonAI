const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

export interface RetryOptions {
  /** Total attempts including the first one. */
  attempts?: number;
  /** Delay before the first retry; doubles on each subsequent retry. */
  baseDelayMs?: number;
  /** Whether an error is worth retrying. Non-retryable errors throw immediately. */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * True for rate limiting (429) and server-side (5xx) failures — the
 * transient errors external AI APIs return under load. Reads `status` (the
 * @google/genai ApiError and OpenAI APIError shape).
 */
export function isTransientHttpError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && (status === 429 || status >= 500);
}

/** Runs `fn`, retrying transient failures with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    attempts = DEFAULT_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    isRetryable = isTransientHttpError,
  }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
