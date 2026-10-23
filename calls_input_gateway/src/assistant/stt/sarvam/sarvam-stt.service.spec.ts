/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';

class FakeSocket {
  readyState = 1;
  handlers: Record<string, (arg: any) => void> = {};
  transcribe = jest.fn();
  close = jest.fn();
  on(event: string, cb: (arg: any) => void) {
    this.handlers[event] = cb;
  }
  waitForOpen = jest.fn().mockResolvedValue(undefined);
  emit(message: unknown) {
    this.handlers.message?.(message);
  }
}

const sockets: FakeSocket[] = [];
const connect = jest.fn(() => {
  const socket = new FakeSocket();
  sockets.push(socket);
  return Promise.resolve(socket);
});
jest.mock('sarvamai', () => ({
  SarvamAIClient: jest.fn(() => ({ speechToTextStreaming: { connect } })),
}));

import { SarvamSttService } from './sarvam-stt.service';

function build(env: Record<string, string> = {}) {
  const config = { get: (key: string) => env[key] };
  return new SarvamSttService(config as any);
}

function audioSession(encoding: 'LINEAR16' | 'MULAW', sampleRateHertz: number) {
  return {
    encoding,
    sampleRateHertz,
    callbacks: { onTranscript: jest.fn(), onBargeIn: jest.fn() },
  };
}

describe('SarvamSttService', () => {
  beforeEach(() => {
    sockets.length = 0;
    connect.mockClear();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('opens an auto-detecting PCM stream at the call sample rate', async () => {
    await build().openConnection('s1', audioSession('MULAW', 8000));
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        'language-code': 'unknown',
        model: 'saaras:v4',
        sample_rate: '8000',
        input_audio_codec: 'pcm_s16le',
        vad_signals: 'true',
      }),
    );
    expect(connect.mock.calls[0][0]).not.toHaveProperty('mode');
  });

  it('decodes μ-law and sends ~100 ms batches', async () => {
    const service = build();
    await service.openConnection('s1', audioSession('MULAW', 8000));
    // 20 ms Twilio frames: 160 μ-law bytes → 320 PCM bytes; 100 ms = 1600 bytes
    for (let i = 0; i < 4; i++)
      service.feedAudio('s1', Buffer.alloc(160, 0xff));
    expect(sockets[0].transcribe).not.toHaveBeenCalled();
    service.feedAudio('s1', Buffer.alloc(160, 0xff));
    expect(sockets[0].transcribe).toHaveBeenCalledTimes(1);
    const sent = sockets[0].transcribe.mock.calls[0][0];
    expect(sent.sample_rate).toBe(8000);
    expect(Buffer.from(sent.audio, 'base64').length).toBe(1600);
  });

  it('fires barge-in on START_SPEECH and delivers transcripts with the tracked language', async () => {
    const service = build();
    const session = audioSession('LINEAR16', 16000);
    await service.openConnection('s1', session);
    service.setPreferredLanguage('s1', 'te');

    sockets[0].emit({ type: 'events', data: { signal_type: 'START_SPEECH' } });
    expect(session.callbacks.onBargeIn).toHaveBeenCalledTimes(1);

    sockets[0].emit({
      type: 'data',
      data: {
        transcript: ' ఈ బైక్ ఎరుపు రంగులో ఉందా? ',
        language_code: 'te-IN',
        language_probability: '0.95',
      },
    });
    sockets[0].emit({
      type: 'data',
      data: {
        transcript: 'ok',
        language_code: 'en-IN',
        language_probability: '0.99',
      },
    });
    sockets[0].emit({
      type: 'data',
      data: {
        transcript: 'Is it available in red?',
        language_code: 'en-IN',
        language_probability: '0.99',
      },
    });
    sockets[0].emit({ type: 'data', data: { transcript: '   ' } });

    expect(session.callbacks.onTranscript.mock.calls).toEqual([
      ['ఈ బైక్ ఎరుపు రంగులో ఉందా?', 'te'],
      ['ok', 'te'],
      ['Is it available in red?', 'en'],
    ]);
  });

  it('applies a preferred language that arrived before the socket opened', async () => {
    const service = build();
    service.setPreferredLanguage('s1', 'hi');
    const session = audioSession('LINEAR16', 16000);
    await service.openConnection('s1', session);
    sockets[0].emit({
      type: 'data',
      data: { transcript: 'haan', language_code: 'hi-IN' },
    });
    expect(session.callbacks.onTranscript).toHaveBeenCalledWith('haan', 'hi');
  });

  it('drops audio for unknown sessions and closes on end', async () => {
    const service = build();
    service.feedAudio('nope', Buffer.alloc(3200));
    await service.openConnection('s1', audioSession('LINEAR16', 16000));
    service.closeConnection('s1');
    expect(sockets[0].close).toHaveBeenCalled();
    service.feedAudio('s1', Buffer.alloc(3200));
    expect(sockets[0].transcribe).not.toHaveBeenCalled();
  });

  it('passes model, mode and pinned language through from env', async () => {
    await build({
      SARVAM_STT_MODEL: 'saaras:v3',
      SARVAM_STT_MODE: 'codemix',
      SARVAM_STT_LANGUAGE: 'hi-IN',
    }).openConnection('s1', audioSession('LINEAR16', 16000));
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'saaras:v3',
        mode: 'codemix',
        'language-code': 'hi-IN',
      }),
    );
  });
  it('reports a drop after open once, but not its own close', async () => {
    const service = build();
    const onFailure = jest.fn();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await service.openConnection(
      's1',
      audioSession('LINEAR16', 16000),
      onFailure,
    );
    sockets[0].handlers.close({ code: 1003, reason: 'Credits exhausted' });
    sockets[0].handlers.close({ code: 1006 });
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toMatch(/1003 Credits exhausted/);

    await service.openConnection(
      's2',
      audioSession('LINEAR16', 16000),
      onFailure,
    );
    service.closeConnection('s2');
    sockets[1].handlers.close({ code: 1000 });
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('treats a Sarvam error message as a failure and stops using the socket', async () => {
    const service = build();
    const onFailure = jest.fn();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await service.openConnection(
      's1',
      audioSession('LINEAR16', 16000),
      onFailure,
    );
    sockets[0].emit({ type: 'error', data: { error: 'quota', code: '429' } });
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(sockets[0].close).toHaveBeenCalled();
    service.feedAudio('s1', Buffer.alloc(3200));
    expect(sockets[0].transcribe).not.toHaveBeenCalled();
  });

  it('rejects when the socket never opens, closing it', async () => {
    connect.mockImplementationOnce(() => {
      const socket = new FakeSocket();
      socket.waitForOpen = jest
        .fn()
        .mockRejectedValue(new Error('non-101 status code'));
      sockets.push(socket);
      return Promise.resolve(socket);
    });
    await expect(
      build().openConnection('s1', audioSession('LINEAR16', 16000)),
    ).rejects.toThrow(/non-101/);
    expect(sockets[0].close).toHaveBeenCalled();
  });
});
