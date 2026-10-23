/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { AudioDriverService } from './audio-driver.service';

// 20 ms Twilio frames: μ-law 0xFF is digital silence, 0x00 is full scale.
const QUIET = Buffer.alloc(160, 0xff);
const LOUD = Buffer.alloc(160, 0x00);
const TWILIO = { encoding: 'MULAW' as const, sampleRateHertz: 8000 };

function build(env: Record<string, string> = {}) {
  const config = {
    get: (key: string) => ({ STT_PROVIDER: 'deepgram', ...env })[key],
  };
  const deepgram = {
    openConnection: jest.fn().mockResolvedValue(undefined),
    feedAudio: jest.fn(),
    closeConnection: jest.fn(),
    setPreferredLanguage: jest.fn().mockResolvedValue(undefined),
  };
  const driver = new AudioDriverService(
    config as any,
    deepgram as any,
    {} as any,
  );
  const callbacks = { onTranscript: jest.fn(), onBargeIn: jest.fn() };
  return { driver, deepgram, callbacks };
}

describe('AudioDriverService opening listen delay', () => {
  let now = 1_000_000;

  /** Feeds `count` 20 ms frames, advancing the clock like real-time audio. */
  function feed(
    driver: AudioDriverService,
    id: string,
    frame: Buffer,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      driver.feedAudio(id, frame);
      now += 20;
    }
  }

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('ignores the first 3.5 s, then listens once the line has been quiet for 300 ms', async () => {
    const { driver, deepgram, callbacks } = build();
    await driver.startSession('CA1', callbacks, TWILIO);

    feed(driver, 'CA1', LOUD, 175); // 0–3.5 s: caller talks over the greeting
    expect(deepgram.feedAudio).not.toHaveBeenCalled();

    feed(driver, 'CA1', QUIET, 14); // 280 ms of quiet — not yet
    expect(deepgram.feedAudio).not.toHaveBeenCalled();
    feed(driver, 'CA1', QUIET, 1); // 300 ms — listening starts
    feed(driver, 'CA1', LOUD, 3); // and everything after is heard
    expect(deepgram.feedAudio).toHaveBeenCalledTimes(4);
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringContaining('ignored first 3500 ms'),
    );
  });

  it('drops a sentence still running when the window ends, instead of hearing its tail', async () => {
    const { driver, deepgram, callbacks } = build();
    await driver.startSession('CA1', callbacks, TWILIO);
    now += 3500;

    feed(driver, 'CA1', LOUD, 40); // 0.8 s more of the same sentence
    feed(driver, 'CA1', QUIET, 15); // the caller pauses
    expect(deepgram.feedAudio).toHaveBeenCalledTimes(1); // only the pause-completing frame
    feed(driver, 'CA1', LOUD, 10); // their next sentence is heard in full
    expect(deepgram.feedAudio).toHaveBeenCalledTimes(11);
  });

  it('starts listening 2 s after the window even if the line never goes quiet', async () => {
    const { driver, deepgram, callbacks } = build();
    await driver.startSession('CA1', callbacks, TWILIO);
    now += 3500;
    feed(driver, 'CA1', LOUD, 100); // exactly 2 s of noise
    expect(deepgram.feedAudio).not.toHaveBeenCalled();
    feed(driver, 'CA1', LOUD, 1);
    expect(deepgram.feedAudio).toHaveBeenCalledTimes(1);
  });

  it('measures quiet for 16 kHz PCM from the web client too', async () => {
    const { driver, deepgram, callbacks } = build();
    await driver.startSession('web-1', callbacks);
    now += 3500;
    driver.feedAudio('web-1', Buffer.alloc(16000 * 2 * 0.3)); // 300 ms of PCM silence
    expect(deepgram.feedAudio).toHaveBeenCalledTimes(1);
  });

  it('times each call from its own start', async () => {
    const { driver, deepgram, callbacks } = build();
    await driver.startSession('CA1', callbacks, TWILIO);
    now += 4000;
    await driver.startSession('CA2', callbacks, TWILIO);
    feed(driver, 'CA1', QUIET, 15);
    feed(driver, 'CA2', QUIET, 15);
    expect(
      new Set(deepgram.feedAudio.mock.calls.map((c: unknown[]) => c[0])),
    ).toEqual(new Set(['CA1']));
  });

  it('uses INITIAL_LISTEN_DELAY_MS, with 0 turning the delay off', async () => {
    const custom = build({ INITIAL_LISTEN_DELAY_MS: '1000' });
    await custom.driver.startSession('CA1', custom.callbacks, TWILIO);
    now += 1000;
    feed(custom.driver, 'CA1', QUIET, 15);
    expect(custom.deepgram.feedAudio).toHaveBeenCalledTimes(1);

    const off = build({ INITIAL_LISTEN_DELAY_MS: '0' });
    await off.driver.startSession('CA1', off.callbacks, TWILIO);
    off.driver.feedAudio('CA1', LOUD);
    expect(off.deepgram.feedAudio).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default for an invalid value', async () => {
    const { driver, deepgram, callbacks } = build({
      INITIAL_LISTEN_DELAY_MS: 'soon',
    });
    await driver.startSession('CA1', callbacks, TWILIO);
    now += 3000;
    feed(driver, 'CA1', QUIET, 15);
    expect(deepgram.feedAudio).not.toHaveBeenCalled();
  });
});
