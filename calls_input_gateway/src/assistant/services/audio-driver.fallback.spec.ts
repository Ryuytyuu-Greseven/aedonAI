/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { AudioDriverService } from './audio-driver.service';

function build(env: Record<string, string> = {}) {
  const config = {
    get: (key: string) => ({ STT_PROVIDER: 'sarvam', ...env })[key],
  };
  const deepgram = {
    openConnection: jest.fn().mockResolvedValue(undefined),
    feedAudio: jest.fn(),
    closeConnection: jest.fn(),
    setPreferredLanguage: jest.fn().mockResolvedValue(undefined),
  };
  let failSarvam: (reason: string) => void = () => undefined;
  const sarvam = {
    openConnection: jest.fn(
      (_id: string, _s: unknown, onFailure: (r: string) => void) => {
        failSarvam = onFailure;
        return Promise.resolve();
      },
    ),
    feedAudio: jest.fn(),
    closeConnection: jest.fn(),
    setPreferredLanguage: jest.fn(),
  };
  const driver = new AudioDriverService(
    config as any,
    deepgram as any,
    sarvam as any,
  );
  const callbacks = { onTranscript: jest.fn(), onBargeIn: jest.fn() };
  return {
    driver,
    deepgram,
    sarvam,
    callbacks,
    fail: (r: string) => failSarvam(r),
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('AudioDriverService Sarvam → Deepgram fallback', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses Sarvam while it is healthy', async () => {
    const { driver, deepgram, sarvam, callbacks } = build();
    await driver.startSession('CA1', callbacks, {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
    });
    driver.feedAudio('CA1', Buffer.alloc(160));
    expect(sarvam.feedAudio).toHaveBeenCalledWith('CA1', expect.any(Buffer));
    expect(deepgram.openConnection).not.toHaveBeenCalled();
  });

  it('starts the call on Deepgram when Sarvam cannot connect', async () => {
    const { driver, deepgram, sarvam, callbacks } = build();
    sarvam.openConnection.mockRejectedValueOnce(
      new Error('non-101 status code'),
    );
    await driver.startSession('CA1', callbacks, {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
    });
    expect(deepgram.openConnection).toHaveBeenCalledWith(
      'CA1',
      expect.objectContaining({
        encoding: 'MULAW',
        sampleRateHertz: 8000,
        callbacks,
      }),
    );
    driver.feedAudio('CA1', Buffer.alloc(160));
    expect(deepgram.feedAudio).toHaveBeenCalled();
    expect(sarvam.feedAudio).not.toHaveBeenCalled();
  });

  it('moves a live call to Deepgram when Sarvam drops, keeping the agent language', async () => {
    const { driver, deepgram, sarvam, callbacks, fail } = build();
    await driver.startSession('CA1', callbacks);
    driver.applyPreferredLanguage('CA1', 'te');
    expect(sarvam.setPreferredLanguage).toHaveBeenCalledWith('CA1', 'te');

    fail('closed 1003 Credits exhausted');
    driver.feedAudio('CA1', Buffer.alloc(320));
    await flush();

    expect(deepgram.openConnection).toHaveBeenCalledTimes(1);
    expect(deepgram.setPreferredLanguage).toHaveBeenCalledWith(
      'CA1',
      'te',
      expect.anything(),
    );
    expect(sarvam.feedAudio).not.toHaveBeenCalled();
    expect(deepgram.feedAudio).toHaveBeenCalled();

    driver.endSession('CA1');
    expect(deepgram.closeConnection).toHaveBeenCalledWith('CA1');
  });

  it('holds audio spoken during the switch and replays it once Deepgram is open', async () => {
    const { driver, deepgram, callbacks, fail } = build();
    let finishOpen: () => void = () => undefined;
    deepgram.openConnection.mockImplementationOnce(
      () => new Promise<void>((r) => (finishOpen = r)),
    );
    await driver.startSession('CA1', callbacks);
    fail('closed 1006');
    driver.feedAudio('CA1', Buffer.from([1, 2]));
    driver.feedAudio('CA1', Buffer.from([3, 4]));
    expect(deepgram.feedAudio).not.toHaveBeenCalled();

    finishOpen();
    await flush();
    expect(
      deepgram.feedAudio.mock.calls.map((c: unknown[]) => [
        ...(c[1] as Buffer),
      ]),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
    driver.feedAudio('CA1', Buffer.from([5, 6]));
    expect(deepgram.feedAudio).toHaveBeenCalledTimes(3);
  });

  it('closes the Deepgram fallback if the call ended while it was connecting', async () => {
    const { driver, deepgram, callbacks, fail } = build();
    let finishOpen: () => void = () => undefined;
    deepgram.openConnection.mockImplementationOnce(
      () => new Promise<void>((r) => (finishOpen = r)),
    );
    await driver.startSession('CA1', callbacks);
    fail('closed 1006');
    driver.endSession('CA1');
    deepgram.closeConnection.mockClear();
    finishOpen();
    await flush();
    expect(deepgram.closeConnection).toHaveBeenCalledWith('CA1');
  });

  it('does nothing extra when the fallback is disabled', async () => {
    const { driver, deepgram, sarvam, callbacks } = build({
      STT_FALLBACK_PROVIDER: 'none',
    });
    sarvam.openConnection.mockRejectedValueOnce(new Error('timeout'));
    await driver.startSession('CA1', callbacks);
    expect(deepgram.openConnection).not.toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringMatching(/no fallback configured/),
    );
  });

  it('leaves Deepgram-configured calls untouched', async () => {
    const { driver, deepgram, sarvam, callbacks } = build({
      STT_PROVIDER: 'deepgram',
    });
    await driver.startSession('CA1', callbacks);
    driver.feedAudio('CA1', Buffer.alloc(320));
    expect(deepgram.openConnection).toHaveBeenCalledTimes(1);
    expect(sarvam.openConnection).not.toHaveBeenCalled();
  });
});
