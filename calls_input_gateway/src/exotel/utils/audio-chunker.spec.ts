import { AudioChunker, EXOTEL_CHUNK_BYTES } from './audio-chunker';

describe('AudioChunker', () => {
  let chunks: Buffer[];
  let chunker: AudioChunker;

  beforeEach(() => {
    jest.useFakeTimers();
    chunks = [];
    chunker = new AudioChunker((c) => chunks.push(Buffer.from(c)));
  });

  afterEach(() => jest.useRealTimers());

  it('emits only full, Exotel-valid chunks while audio keeps arriving', () => {
    chunker.push(Buffer.alloc(1000, 1));
    chunker.push(Buffer.alloc(5000, 2));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBe(EXOTEL_CHUNK_BYTES);
    expect(EXOTEL_CHUNK_BYTES % 320).toBe(0);
    // Order preserved across push boundaries.
    expect(chunks[0][999]).toBe(1);
    expect(chunks[0][1000]).toBe(2);
  });

  it('pads the tail with silence once audio goes idle', () => {
    chunker.push(Buffer.alloc(500, 7));
    expect(chunks).toHaveLength(0);
    jest.advanceTimersByTime(100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBe(EXOTEL_CHUNK_BYTES);
    expect(chunks[0][499]).toBe(7);
    expect(chunks[0][500]).toBe(0);
  });

  it('pads u-law audio with u-law silence', () => {
    const mulaw = new AudioChunker((c) => chunks.push(Buffer.from(c)), 0xff);
    mulaw.push(Buffer.alloc(10, 1));
    mulaw.flush();
    expect(chunks[0][10]).toBe(0xff);
  });

  it('drops buffered audio on clear()', () => {
    chunker.push(Buffer.alloc(500, 7));
    chunker.clear();
    jest.advanceTimersByTime(1000);
    chunker.flush();
    expect(chunks).toHaveLength(0);
  });
});
