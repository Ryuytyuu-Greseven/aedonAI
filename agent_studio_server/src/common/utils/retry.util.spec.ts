import { isTransientHttpError, withRetry } from './retry.util';

describe('withRetry', () => {
  const httpError = (status: number) => Object.assign(new Error('x'), { status });

  it('retries a transient failure and returns the eventual result', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce('ok');

    await expect(withRetry(fn, { baseDelayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured number of attempts', async () => {
    const fn = jest.fn().mockRejectedValue(httpError(503));

    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toMatchObject({
      status: 503,
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-transient failure', async () => {
    const fn = jest.fn().mockRejectedValue(httpError(400));

    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toMatchObject({
      status: 400,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isTransientHttpError', () => {
  it('treats 429 and 5xx as transient, everything else not', () => {
    expect(isTransientHttpError({ status: 429 })).toBe(true);
    expect(isTransientHttpError({ status: 500 })).toBe(true);
    expect(isTransientHttpError({ status: 404 })).toBe(false);
    expect(isTransientHttpError(new Error('network'))).toBe(false);
    expect(isTransientHttpError(null)).toBe(false);
  });
});
