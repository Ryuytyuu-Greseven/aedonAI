import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { audioToWav } from '../helpers/audio.helper';

export type SpokenLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'unclear';

// 'unclear' is a valid classification result (Gemini found no confident
// signal) — distinct from `null`, which means the call itself failed.
const SUPPORTED_LANGUAGES: SpokenLanguage[] = [
  'en',
  'hi',
  'te',
  'ta',
  'kn',
  'unclear',
];

/**
 * Classifies which of en/hi/te/ta/kn a short utterance's audio is spoken in,
 * using a small Vertex AI Gemini model. Used to drive STT language switching
 * for the languages Deepgram's own `multi` code-switching mode doesn't cover
 * (te/ta/kn) — see DeepGram.checkLanguageSwitch.
 */
@Injectable()
export class LanguageIdService {
  private readonly logger = new Logger(LanguageIdService.name);
  private readonly genAi: GoogleGenAI;
  private readonly modelId: string;

  constructor(private readonly configService: ConfigService) {
    this.genAi = new GoogleGenAI({
      vertexai: true,
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
    this.modelId =
      this.configService.get<string>('LANGUAGE_ID_MODEL') ||
      'gemini-3.1-flash-lite';
  }

  async identifyLanguage(
    audioBuffer: Buffer,
    encoding: 'LINEAR16' | 'MULAW',
    sampleRateHertz: number,
  ): Promise<SpokenLanguage | null> {
    if (!audioBuffer || audioBuffer.length === 0) return null;

    try {
      const wavBuffer = audioToWav(audioBuffer, encoding, sampleRateHertz);
      const response = await this.genAi.models.generateContent({
        model: this.modelId,
        contents: [
          {
            text:
              'Listen to this short clip of one side of a phone call. Identify the ' +
              'single dominant spoken language. Respond with exactly one of: ' +
              'en, hi, te, ta, kn. If the audio is mostly silence, noise, cross-talk, ' +
              'or you cannot confidently identify a single dominant language among ' +
              'those five, respond with "unclear" instead of guessing.',
          },
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: wavBuffer.toString('base64'),
            },
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING, enum: SUPPORTED_LANGUAGES },
            },
            required: ['language'],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      const language = parsed?.language;
      return SUPPORTED_LANGUAGES.includes(language) ? language : null;
    } catch (err: any) {
      this.logger.error(
        `[LanguageId] Failed to identify language: ${err.message || err}`,
      );
      return null;
    }
  }
}
