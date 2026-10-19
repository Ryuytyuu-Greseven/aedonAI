import { Injectable, OnDestroy } from '@angular/core';
import { MIC_SAMPLE_RATE } from './audio-processor.types';

/**
 * Captures microphone audio as LINEAR16 (signed 16-bit LE) mono @ 16 kHz and emits
 * base64-encoded chunks. Uses ScriptProcessor for broad support (see websockets.md).
 */
@Injectable()
export class PcmCaptureService implements OnDestroy {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;

  /**
   * Request mic access and start streaming base64 PCM chunks to `onChunk`.
   * `onLevel`, when provided, receives a smoothed 0..1 loudness value per frame,
   * useful for driving a live voice-activity visualization.
   * Throws if permission is denied or capture cannot start.
   */
  async start(
    onChunk: (base64Pcm: string) => void,
    onLevel?: (level: number) => void,
  ): Promise<void> {
    if (this.audioContext) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;

    const audioContext = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
    this.audioContext = audioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    this.source = source;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    this.processor = processor;

    processor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0);
      onChunk(this.encodeChunk(float32));
      if (onLevel) onLevel(this.computeLevel(float32));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  async stop(): Promise<void> {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.smoothedLevel = 0;
  }

  ngOnDestroy(): void {
    void this.stop();
  }

  private smoothedLevel = 0;

  /** Root-mean-square loudness of a frame, normalized and smoothed to a 0..1 range. */
  private computeLevel(float32: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < float32.length; i++) {
      sumSquares += float32[i] * float32[i];
    }
    const rms = Math.sqrt(sumSquares / float32.length);
    // Speech RMS is typically well below 1; scale up and clamp for a lively meter.
    const normalized = Math.min(1, rms * 4);
    // Exponential smoothing so the meter rises fast and falls gently.
    this.smoothedLevel = Math.max(normalized, this.smoothedLevel * 0.8);
    return this.smoothedLevel;
  }

  private encodeChunk(float32: Float32Array): string {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
