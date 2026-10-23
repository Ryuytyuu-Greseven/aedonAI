import { mulawToLinear16 } from './audio.helper';

describe('mulawToLinear16', () => {
  it('decodes G.711 μ-law bytes to 16-bit PCM', () => {
    const pcm = mulawToLinear16(Buffer.from([0xff, 0x7f, 0x00, 0x80]));
    expect(pcm.length).toBe(8);
    expect([0, 1, 2, 3].map((i) => pcm.readInt16LE(i * 2))).toEqual([
      0, 0, -32124, 32124,
    ]);
  });
});
