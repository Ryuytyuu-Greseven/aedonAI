export interface LanguageTrackerOptions {
  /** Starting language — normally the agent's configured one. */
  initial: string;
  /** Languages a switch may land on (what the TTS can speak). */
  supported: ReadonlySet<string>;
  /** Ignore detections below this probability, when one is reported. */
  minConfidence: number;
  /** Ignore detections on utterances shorter than this ("ok", "haan"). */
  minWords: number;
}

/**
 * Turns per-utterance language detections from an STT provider into a stable
 * conversation language: one confident, non-trivial utterance in a speakable
 * language switches it; noise, one-word replies and languages the TTS can't
 * voice leave it where it is.
 */
export class LanguageTracker {
  private current: string;

  constructor(private readonly options: LanguageTrackerOptions) {
    this.current = options.initial;
  }

  get language(): string {
    return this.current;
  }

  /** Config-driven reset, e.g. once the agent's language is known. */
  reset(language: string): void {
    if (this.options.supported.has(language)) this.current = language;
  }

  observe(
    detected: string | null,
    confidence: number | null,
    text: string,
  ): string {
    if (!detected || detected === this.current) return this.current;
    if (!this.options.supported.has(detected)) return this.current;
    if (confidence !== null && confidence < this.options.minConfidence) {
      return this.current;
    }
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words < this.options.minWords) return this.current;

    this.current = detected;
    return this.current;
  }
}
