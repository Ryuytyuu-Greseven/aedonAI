/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { CallLogService } from './call-log.service';

function build(repo: Record<string, jest.Mock>) {
  return new CallLogService(repo as any);
}

describe('CallLogService transcript writes', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('appends a trimmed entry with speaker and timestamp', async () => {
    const append = jest.fn().mockResolvedValue(true);
    await build({ appendConversationEntry: append }).logMessage('CA1', {
      message: '  Is the red one available?  ',
      speaker: 'customer',
    });

    expect(append).toHaveBeenCalledWith(
      'CA1',
      expect.objectContaining({
        message: 'Is the red one available?',
        speaker: 'customer',
        timestamp: expect.any(Date),
      }),
    );
  });

  it('skips blank messages', async () => {
    const append = jest.fn();
    await build({ appendConversationEntry: append }).logMessage('CA1', {
      message: '   ',
      speaker: 'ai_agent',
    });
    expect(append).not.toHaveBeenCalled();
  });

  it('warns instead of failing silently when the call log is missing', async () => {
    const append = jest.fn().mockResolvedValue(false);
    await build({ appendConversationEntry: append }).logMessage('CA404', {
      message: 'hello',
      speaker: 'customer',
    });
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('CA404'),
    );
  });

  it('never rejects when the write throws', async () => {
    const append = jest.fn().mockRejectedValue(new Error('mongo down'));
    await expect(
      build({ appendConversationEntry: append }).logMessage('CA1', {
        message: 'hello',
        speaker: 'customer',
      }),
    ).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('endCallLog never rejects when finalize throws', async () => {
    const finalize = jest.fn().mockRejectedValue(new Error('mongo down'));
    await expect(
      build({ finalize }).endCallLog('CA1'),
    ).resolves.toBeUndefined();
  });
});
