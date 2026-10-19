import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';

const LANGUAGE_NAMES: Record<string, string> = {
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
};

/**
 * Translates the LLM's (always-English) reply into the caller's detected
 * spoken language right before it reaches TTS. The domain-agent
 * microservices this gateway calls into always respond in English
 * regardless of what language the customer spoke, and that's outside this
 * repo's control — so the fix lives here, as the last step before speech.
 */
@Injectable()
export class VoiceTranslationAdapterService {
  private readonly logger = new Logger(VoiceTranslationAdapterService.name);
  private readonly genAi: GoogleGenAI;
  private readonly modelId: string;

  constructor(private readonly configService: ConfigService) {
    this.genAi = new GoogleGenAI({
      vertexai: true,
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
    this.modelId =
      this.configService.get<string>('TRANSLATION_MODEL') ||
      'gemini-3.1-flash-lite';
  }

  /**
   * Returns `text` translated into `targetLanguage` ('hi'|'te'|'ta'|'kn'),
   * or unchanged if targetLanguage is English/unclear/unsupported, or if
   * translation fails for any reason — never throws, never returns empty.
   */
  async adaptForVoice(text: string, targetLanguage: string): Promise<string> {
    if (!text || !text.trim()) return text;

    const languageName = LANGUAGE_NAMES[targetLanguage];
    if (!languageName) return text;

    try {
      const response = await this.genAi.models.generateContent({
        model: this.modelId,
        contents: [
          {
            text:
              `You are translating a short spoken-voice-assistant reply that is about ` +
              `to be read aloud by text-to-speech to a phone caller. Translate the ` +
              `entire text into natural, conversational, SPOKEN-register ${languageName} ` +
              `— the way a fluent human phone agent would actually say it, not a ` +
              `literal or written-register translation.\n\n` +
              `Rules:\n` +
              `- Output ONLY the translated text. No preamble, quotes, labels, or explanation.\n` +
              `- If the text is already fully written in ${languageName}, return it verbatim, unchanged.\n` +
              `- Keep all digits, currency amounts, dates, and proper/product/company names ` +
              `exactly as written in the input — do not transliterate numbers into words ` +
              `or native-script numerals.\n\n` +
              `Text to translate:\n"""\n${text}\n"""`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { translatedText: { type: Type.STRING } },
            required: ['translatedText'],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      const translated = parsed?.translatedText;
      return typeof translated === 'string' && translated.trim()
        ? translated
        : text;
    } catch (err: any) {
      this.logger.error(
        `[VoiceTranslationAdapter] Failed to translate to ${targetLanguage}: ${err.message || err}`,
      );
      return text;
    }
  }
}
