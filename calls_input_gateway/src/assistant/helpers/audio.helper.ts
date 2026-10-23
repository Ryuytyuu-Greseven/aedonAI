export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 16000,
): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

/** Wraps raw mono telephony/mic audio in a WAV container so it can be sent
 * to APIs (e.g. Gemini's audio understanding) that require a standard
 * container format rather than headerless PCM/mulaw. */
export function audioToWav(
  buffer: Buffer,
  encoding: 'LINEAR16' | 'MULAW',
  sampleRate: number,
): Buffer {
  if (encoding === 'LINEAR16') {
    return pcmToWav(buffer, sampleRate);
  }

  // MULAW: 8-bit, mono, WAVE_FORMAT_MULAW (format code 7)
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + buffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(buffer.length, 40);
  return Buffer.concat([header, buffer]);
}

/** G.711 μ-law (Twilio's 8 kHz telephony audio) → 16-bit little-endian PCM,
 * same sample rate. For STT APIs that only take linear PCM. */
export function mulawToLinear16(mulaw: Buffer): Buffer {
  const pcm = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) {
    pcm.writeInt16LE(decodeMulawSample(mulaw[i]), i * 2);
  }
  return pcm;
}

function decodeMulawSample(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + 0x84) << exponent) - 0x84;
  return sign ? -magnitude : magnitude;
}
