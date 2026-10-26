/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';

/** Answers every flush with one PCM chunk then a `final`, like the real API. */
class FakeTtsSocket {
  handlers: Record<string, (arg: any) => void> = {};
  configureConnection = jest.fn();
  convert = jest.fn();
  close = jest.fn();
  waitForOpen = jest.fn().mockResolvedValue(undefined);
  audioPerFlush: Buffer[] = [Buffer.alloc(4800, 1)];
  sendFinal = true;
  on(event: string, cb: (arg: any) => void) {
    this.handlers[event] = cb;
  }
  flush = jest.fn(() => {
    setImmediate(() => {
      for (const audio of this.audioPerFlush) {
        this.handlers.message?.({
          type: 'audio',
          data: { audio: audio.toString('base64'), content_type: 'audio/pcm' },
        });
      }
      if (this.sendFinal) {
        this.handlers.message?.({
          type: 'event',
          data: { event_type: 'final' },
        });
      }
    });
  });
}

let nextSocket: FakeTtsSocket;
const connect = jest.fn(() => Promise.resolve(nextSocket));
jest.mock('sarvamai', () => ({
  SarvamAIClient: jest.fn(() => ({ textToSpeechStreaming: { connect } })),
}));

import { SarvamTtsService } from './sarvam-tts.service';
import { SARVAM_VOICES } from '../../speech/voices/sarvam.voices';

async function* reply(...parts: string[]) {
  for (const text of parts) yield { text };
}

function run(
  parts: string[],
  session: any = { isGenerating: true, language: 'te' },
  env: Record<string, string> = {},
  voice = 'female_1',
) {
  const service = new SarvamTtsService({ get: (k: string) => env[k] } as any);
  const out: { audio: string; text: string }[] = [];
  const done = service.textToSpeech(
    reply(...parts),
    voice,
    (audio, text) => out.push({ audio, text }),
    session,
    {},
  );
  return { done, out, session };
}

describe('SarvamTtsService', () => {
  beforeEach(() => {
    nextSocket = new FakeTtsSocket();
    connect.mockClear();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("configures 24 kHz linear16 in the session language with the agent voice's speaker", async () => {
    const { done } = run(
      ['నమస్కారం.'],
      undefined,
      { SARVAM_TTS_MODEL: 'bulbul:v3' },
      'female_2',
    );
    await done;
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'bulbul:v3',
        send_completion_event: 'true',
        reconnectAttempts: 0,
      }),
    );
    expect(nextSocket.configureConnection).toHaveBeenCalledWith({
      type: 'config',
      data: expect.objectContaining({
        language_code: 'te-IN',
        speaker: SARVAM_VOICES.female_2,
        speech_sample_rate: 24000,
        output_audio_codec: 'linear16',
      }),
    });
  });

  it('sends each sentence then flushes, text ahead of its audio, and waits for every final', async () => {
    const { done, out } = run(['Hi there! The Classic', ' 350 is in stock.']);
    await done;
    expect(nextSocket.convert.mock.calls.map((c) => c[0])).toEqual([
      'Hi there!',
      'The Classic 350 is in stock.',
    ]);
    expect(nextSocket.flush).toHaveBeenCalledTimes(2);
    expect(
      out.map((o) => (o.text ? `text:${o.text.trim()}` : 'audio')),
    ).toEqual([
      'text:Hi there!',
      'text:The Classic 350 is in stock.',
      'audio',
      'audio',
    ]);
    expect(nextSocket.close).toHaveBeenCalled();
  });

  it('keeps 16-bit samples whole when a chunk has an odd length', async () => {
    nextSocket.audioPerFlush = [Buffer.alloc(5, 1), Buffer.alloc(3, 1)];
    const { done, out } = run(['Hello.']);
    await done;
    const sizes = out
      .filter((o) => o.audio)
      .map((o) => Buffer.from(o.audio, 'base64').length);
    expect(sizes).toEqual([4, 4]);
  });

  it('stops sending audio after barge-in', async () => {
    nextSocket.sendFinal = false;
    const session: any = { isGenerating: true, language: 'en' };
    const { done, out } = run(['One. Two.'], session);
    await new Promise((r) => setImmediate(r));
    session.isGenerating = false;
    session.abortTts?.();
    await done;
    expect(nextSocket.close).toHaveBeenCalled();
    const before = out.length;
    nextSocket.handlers.message({
      type: 'audio',
      data: { audio: Buffer.alloc(4).toString('base64') },
    });
    expect(out.length).toBe(before);
  });

  it('ends the turn instead of hanging when Sarvam reports an error', async () => {
    nextSocket.flush = jest.fn(() => {
      setImmediate(() =>
        nextSocket.handlers.message?.({
          type: 'error',
          data: { message: 'Credits exhausted', code: 402 },
        }),
      );
    });
    const { done, out } = run(['Hello.']);
    await done;
    expect(out.filter((o) => o.audio)).toHaveLength(0);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
  it('retries a handshake that times out, and still speaks the reply', async () => {
    const failed = new FakeTtsSocket();
    failed.waitForOpen = jest.fn().mockRejectedValue(new Error('TIMEOUT'));
    const good = nextSocket;
    connect
      .mockImplementationOnce(() => Promise.resolve(failed))
      .mockImplementationOnce(() => Promise.resolve(good));

    const { done, out } = run(['Hello.']);
    await done;

    expect(connect).toHaveBeenCalledTimes(2);
    expect(failed.close).toHaveBeenCalled();
    expect(good.convert).toHaveBeenCalledWith('Hello.');
    expect(out.filter((o) => o.audio).length).toBeGreaterThan(0);
  });

  it('gives up after the second failed handshake without hanging', async () => {
    const failing = () => {
      const s = new FakeTtsSocket();
      s.waitForOpen = jest.fn().mockRejectedValue(new Error('TIMEOUT'));
      return Promise.resolve(s);
    };
    connect.mockImplementationOnce(failing).mockImplementationOnce(failing);

    const { done, out } = run(['Hello.']);
    await done;

    expect(connect).toHaveBeenCalledTimes(2);
    expect(out.filter((o) => o.audio)).toHaveLength(0);
  });
});
