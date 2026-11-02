/** Sample rate of the linear16 PCM every TTS provider hands to the client. */
export const TTS_SAMPLE_RATE = 24000;

/**
 * G.711 u-law encoding of a single 16-bit signed PCM sample → 8-bit mulaw byte.
 */
function encodeMulawSample(sample: number): number {
  const BIAS = 0x84; // 132

  if (sample > 32767) sample = 32767;
  else if (sample < -32767) sample = -32767;

  const sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;

  sample += BIAS;

  let exp = 7;
  let mask = 0x4000;
  while (exp > 0 && !(sample & mask)) {
    exp--;
    mask >>= 1;
  }

  const mantissa = (sample >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | mantissa) & 0xff;
}

/** Encodes linear16 PCM (little-endian) to G.711 u-law, 1 byte per sample. */
export function encodeLinear16ToMulaw(pcm: Buffer): Buffer {
  const mulaw = Buffer.alloc(Math.floor(pcm.length / 2));
  for (let i = 0; i < mulaw.length; i++) {
    mulaw[i] = encodeMulawSample(pcm.readInt16LE(i * 2));
  }
  return mulaw;
}

/**
 * Downsample a linear16 buffer by averaging every `factor` consecutive samples.
 * Simple averaging preserves loudness and avoids aliasing for speech.
 */
function downsampleByAveraging(input: Buffer, factor: number): Buffer {
  const inputSamples = Math.floor(input.length / 2);
  const outputSamples = Math.floor(inputSamples / factor);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    let sum = 0;
    const end = Math.min((i + 1) * factor, inputSamples);
    for (let j = i * factor; j < end; j++) {
      sum += input.readInt16LE(j * 2);
    }
    output.writeInt16LE(Math.round(sum / factor), i * 2);
  }

  return output;
}

/** Linear-interpolation resampler for non-integer rate ratios. */
function resampleByInterpolation(
  input: Buffer,
  fromRate: number,
  toRate: number,
): Buffer {
  const inputSamples = Math.floor(input.length / 2);
  if (inputSamples === 0) return Buffer.alloc(0);
  const outputSamples = Math.floor((inputSamples * toRate) / fromRate);
  const output = Buffer.alloc(outputSamples * 2);
  const step = fromRate / toRate;

  for (let i = 0; i < outputSamples; i++) {
    const pos = i * step;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, inputSamples - 1);
    const s0 = input.readInt16LE(i0 * 2);
    const s1 = input.readInt16LE(i1 * 2);
    output.writeInt16LE(Math.round(s0 + (s1 - s0) * (pos - i0)), i * 2);
  }

  return output;
}

/** Resamples mono linear16 PCM between sample rates (e.g. TTS 24 kHz → 8 kHz). */
export function resampleLinear16(
  input: Buffer,
  fromRate: number,
  toRate: number,
): Buffer {
  if (fromRate === toRate) return input;
  if (fromRate > toRate && fromRate % toRate === 0) {
    return downsampleByAveraging(input, fromRate / toRate);
  }
  return resampleByInterpolation(input, fromRate, toRate);
}
