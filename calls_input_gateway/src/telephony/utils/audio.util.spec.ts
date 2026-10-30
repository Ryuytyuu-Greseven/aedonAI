import { mulawToLinear16 } from '../../assistant/helpers/audio.helper';
import { encodeLinear16ToMulaw, resampleLinear16 } from './audio.util';

function pcm(samples: number[]): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2));
  return buf;
}

function samples(buf: Buffer): number[] {
  return Array.from({ length: buf.length / 2 }, (_, i) => buf.readInt16LE(i * 2));
}

describe('resampleLinear16', () => {
  it('averages integer-factor downsampling (TTS 24 kHz → 8 kHz)', () => {
    expect(samples(resampleLinear16(pcm([3, 6, 9, 30, 30, 30]), 24000, 8000))).toEqual([6, 30]);
  });

  it('interpolates non-integer ratios (24 kHz → 16 kHz)', () => {
    const out = resampleLinear16(pcm([0, 300, 600, 900, 1200, 1500]), 24000, 16000);
    expect(samples(out)).toEqual([0, 450, 900, 1350]);
  });

  it('passes audio through when rates match', () => {
    const input = pcm([1, 2, 3]);
    expect(resampleLinear16(input, 24000, 24000)).toBe(input);
  });
});

describe('encodeLinear16ToMulaw', () => {
  it('round-trips through the u-law decoder within quantisation error', () => {
    const input = [0, 1000, -1000, 8000, -8000, 30000];
    const decoded = samples(mulawToLinear16(encodeLinear16ToMulaw(pcm(input))));
    decoded.forEach((s, i) => {
      expect(Math.abs(s - input[i])).toBeLessThanOrEqual(Math.abs(input[i]) * 0.07 + 8);
    });
  });
});
