import { ExotelClientAdapter } from './exotel-client.adapter';
import { EXOTEL_CHUNK_BYTES } from '../utils/audio-chunker';

function fakeSocket() {
  return {
    readyState: 1,
    sent: [] as any[],
    send(data: string) {
      this.sent.push(JSON.parse(data));
    },
    close: jest.fn(),
  };
}

/** 24 kHz linear16 TTS audio, as AssistantService.onAudioChunk sends it. */
function ttsMessage(ms: number) {
  const bytes = (24000 * 2 * ms) / 1000;
  return JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/l16',
              data: Buffer.alloc(bytes, 0x10).toString('base64'),
            },
          },
        ],
      },
    },
  });
}

describe('ExotelClientAdapter', () => {
  let socket: ReturnType<typeof fakeSocket>;
  let adapter: ExotelClientAdapter;

  beforeEach(() => {
    jest.useFakeTimers();
    socket = fakeSocket();
    adapter = new ExotelClientAdapter(socket);
    adapter.streamSid = 'MZ123';
  });

  afterEach(() => jest.useRealTimers());

  it('sends 8 kHz PCM in Exotel-sized media events with snake_case stream_sid', () => {
    adapter.send(ttsMessage(500)); // 500 ms → 8000 bytes at 8 kHz PCM
    adapter.send(JSON.stringify({ serverContent: { turnComplete: true } }));

    expect(socket.sent).toHaveLength(3);
    for (const msg of socket.sent) {
      expect(msg.event).toBe('media');
      expect(msg.stream_sid).toBe('MZ123');
      expect(Buffer.from(msg.media.payload, 'base64').length).toBe(
        EXOTEL_CHUNK_BYTES,
      );
    }
  });

  it('resamples to the stream rate reported in the start event', () => {
    adapter.setFormat({ encoding: 'LINEAR16', sampleRateHertz: 16000 });
    adapter.send(ttsMessage(100)); // 100 ms → 3200 bytes at 16 kHz PCM
    expect(socket.sent).toHaveLength(1);
  });

  it('clears both its own buffer and Exotel playback on barge-in', () => {
    adapter.send(ttsMessage(100)); // 1600 bytes — below one chunk, buffered
    adapter.send(JSON.stringify({ serverContent: { interrupted: true } }));
    jest.advanceTimersByTime(1000);

    expect(socket.sent).toEqual([{ event: 'clear', stream_sid: 'MZ123' }]);
  });

  it('ignores text-only messages', () => {
    adapter.send(JSON.stringify({ userContent: { text: 'hi' } }));
    adapter.send(JSON.stringify({ serverContent: { turnStart: true } }));
    expect(socket.sent).toHaveLength(0);
  });

  it('hangs up by closing the socket', () => {
    adapter.close();
    expect(socket.close).toHaveBeenCalled();
  });
});
