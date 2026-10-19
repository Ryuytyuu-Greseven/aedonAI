import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { pcmToWav } from '../../assistant/helpers/audio.helper';
import { decodeMulawToLinear16 } from '../utils/audio.util';

const TWILIO_MULAW_SAMPLE_RATE = 8000;

@Injectable()
export class LovebytRecordingService {
  private readonly logger = new Logger(LovebytRecordingService.name);

  async saveLovebytRecording(
    streamSid: string,
    chunks: Buffer[],
    startedAt: number,
  ): Promise<void> {
    if (chunks.length === 0) {
      this.logger.warn(
        `[LovebytRecording] No audio captured for stream ${streamSid} — skipping save.`,
      );
      return;
    }

    const mulawAudio = Buffer.concat(chunks);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const linear16 = decodeMulawToLinear16(mulawAudio);
    const wavBuffer = pcmToWav(linear16, TWILIO_MULAW_SAMPLE_RATE);

    const recordingsDir = path.join(process.cwd(), 'recordings', 'lovebyt');
    fs.mkdirSync(recordingsDir, { recursive: true });

    const filename = `lovebyt_${streamSid}_${startedAt}.wav`;
    const filePath = path.join(recordingsDir, filename);

    await fs.promises.writeFile(filePath, wavBuffer);

    const durationSec = (mulawAudio.length / TWILIO_MULAW_SAMPLE_RATE).toFixed(1);
    this.logger.log(
      `[LovebytRecording] Saved ${filename} (${durationSec}s, ${chunks.length} chunks)`,
    );
  }
}
