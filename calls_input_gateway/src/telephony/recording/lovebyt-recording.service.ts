import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  mulawToLinear16,
  pcmToWav,
} from '../../assistant/helpers/audio.helper';
import { CarrierAudioFormat } from '../telephony.types';

@Injectable()
export class LovebytRecordingService {
  private readonly logger = new Logger(LovebytRecordingService.name);

  async saveLovebytRecording(
    streamSid: string,
    chunks: Buffer[],
    startedAt: number,
    audio: CarrierAudioFormat,
  ): Promise<void> {
    if (chunks.length === 0) {
      this.logger.warn(
        `[LovebytRecording] No audio captured for stream ${streamSid} — skipping save.`,
      );
      return;
    }

    const raw = Buffer.concat(chunks);
    const linear16 = audio.encoding === 'MULAW' ? mulawToLinear16(raw) : raw;
    const wavBuffer = pcmToWav(linear16, audio.sampleRateHertz);

    const recordingsDir = path.join(process.cwd(), 'recordings', 'lovebyt');
    fs.mkdirSync(recordingsDir, { recursive: true });

    const filename = `lovebyt_${streamSid}_${startedAt}.wav`;
    const filePath = path.join(recordingsDir, filename);

    await fs.promises.writeFile(filePath, wavBuffer);

    const durationSec = (linear16.length / 2 / audio.sampleRateHertz).toFixed(1);
    this.logger.log(
      `[LovebytRecording] Saved ${filename} (${durationSec}s, ${chunks.length} chunks)`,
    );
  }
}
