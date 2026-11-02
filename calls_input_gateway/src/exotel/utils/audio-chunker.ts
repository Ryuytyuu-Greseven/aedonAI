/**
 * Exotel plays bot audio only in chunks of 3.2 KB–100 KB that are multiples
 * of 320 bytes; other sizes cause gaps or distortion. Small, fixed chunks keep
 * `clear` (barge-in) responsive, since it only drops audio not yet playing.
 */
export const EXOTEL_CHUNK_BYTES = 3200;
// A sentence's tail is padded out and sent once TTS goes quiet this long.
const IDLE_FLUSH_MS = 100;

/**
 * Re-slices a stream of arbitrarily sized TTS audio buffers into fixed-size
 * chunks. The last partial chunk is padded with silence and sent on flush(),
 * or automatically once no audio has arrived for IDLE_FLUSH_MS.
 */
export class AudioChunker {
  private pending = Buffer.alloc(0);
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly emit: (chunk: Buffer) => void,
    /** Byte value of silence: 0x00 for linear16 PCM, 0xFF for u-law. */
    private readonly silenceByte = 0x00,
    private readonly chunkBytes = EXOTEL_CHUNK_BYTES,
  ) {}

  push(audio: Buffer): void {
    this.pending = Buffer.concat([this.pending, audio]);
    while (this.pending.length >= this.chunkBytes) {
      this.emit(this.pending.subarray(0, this.chunkBytes));
      this.pending = this.pending.subarray(this.chunkBytes);
    }
    this.cancelIdleFlush();
    if (this.pending.length > 0) {
      this.idleTimer = setTimeout(() => this.flush(), IDLE_FLUSH_MS);
    }
  }

  /** Sends whatever is buffered, padded with silence to a full chunk. */
  flush(): void {
    this.cancelIdleFlush();
    if (this.pending.length === 0) return;
    const chunk = Buffer.alloc(this.chunkBytes, this.silenceByte);
    this.pending.copy(chunk);
    this.pending = Buffer.alloc(0);
    this.emit(chunk);
  }

  /** Drops buffered audio without sending it (barge-in, hangup). */
  clear(): void {
    this.cancelIdleFlush();
    this.pending = Buffer.alloc(0);
  }

  private cancelIdleFlush(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
