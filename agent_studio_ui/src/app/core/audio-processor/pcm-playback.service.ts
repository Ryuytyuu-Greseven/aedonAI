import { Injectable, OnDestroy } from '@angular/core';
import { PLAYBACK_SAMPLE_RATE } from './audio-processor.types';

/**
 * Plays base64 LINEAR16 (signed 16-bit LE) mono @ 24 kHz TTS chunks through the Web
 * Audio API, scheduling them back-to-back for gapless playback. Supports immediate
 * stop for barge-in (see websockets.md `interrupted`).
 */
@Injectable()
export class PcmPlaybackService implements OnDestroy {
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];

  /** Decode and schedule a base64 PCM chunk for playback. */
  enqueue(base64Pcm: string): void {
    const audioContext = this.ensureContext();
    const int16 = this.base64ToInt16(base64Pcm);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = audioContext.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    const now = audioContext.currentTime;
    if (this.nextPlayTime < now) this.nextPlayTime = now;
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;

    this.scheduledSources.push(source);
    source.onended = () => {
      this.scheduledSources = this.scheduledSources.filter((s) => s !== source);
    };
  }

  /** Stop all playback and clear the queue immediately (barge-in). */
  stopImmediately(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.scheduledSources = [];
    this.nextPlayTime = 0;
  }

  dispose(): void {
    this.stopImmediately();
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
}
