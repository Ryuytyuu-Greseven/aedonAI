import {
  FILLER_PHRASES,
  FillerKind,
  FillerLanguage,
  FillerPhrases,
  SLOW_NODE_FILLERS,
} from './sales.fillers.js';

// Shared across the sales agents (identical file in every agent repo); only
// sales.fillers.ts — the phrases and which nodes are slow — is per vertical.

export const FILLER_LANGUAGES: readonly FillerLanguage[] = ['en', 'hi', 'te', 'ta', 'kn'];

/** The sentinel the gateway sends to start a call; its turn is the greeting. */
export const CONVERSATION_START = 'SYSTEM_START_CONVERSATION';

const DEFAULT_GENERIC_AFTER_MS = 3000;
// Measured RAG turns reply ~5 s after their filler; a "still working" line
// any sooner would land just before the reply and delay it.
const DEFAULT_STILL_WORKING_AFTER_MS = 7000;
const MAX_FILLERS_PER_TURN = 2;

const LANGUAGE_NAMES: Record<string, FillerLanguage> = {
  english: 'en',
  hindi: 'hi',
  telugu: 'te',
  tamil: 'ta',
  kannada: 'kn',
};

function toFillerLanguage(value: string | null | undefined): FillerLanguage | null {
  const normalised = value?.trim().toLowerCase();
  if (!normalised) return null;
  const code = normalised.split(/[-_]/)[0];
  if ((FILLER_LANGUAGES as readonly string[]).includes(code)) return code as FillerLanguage;
  return LANGUAGE_NAMES[normalised] ?? null;
}

/**
 * The first candidate that is a supported filler language — accepts codes
 * ('te'), locales ('te-IN') and names ('Telugu') — else English.
 */
export function resolveFillerLanguage(...candidates: (string | null | undefined)[]): FillerLanguage {
  for (const candidate of candidates) {
    const language = toFillerLanguage(candidate);
    if (language) return language;
  }
  return 'en';
}

function readMs(envName: string, fallback: number): number {
  const parsed = Number(process.env[envName]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Per-call state, so the same phrase isn't spoken twice in a row across turns. */
export interface FillerMemory {
  lastPhrase: string | null;
}

export interface SentFiller {
  kind: FillerKind;
  text: string;
  /** Milliseconds since the turn started. */
  atMs: number;
}

export interface FillerControllerOptions {
  /** Delivers a filler to the caller (the agent gateway sends it to the audio gateway). */
  send: (text: string) => void;
  language: FillerLanguage;
  memory: FillerMemory;
  /** True for the greeting turn, which never gets a filler. */
  isConversationStart: boolean;
  genericAfterMs?: number;
  stillWorkingAfterMs?: number;
  random?: () => number;
  phrases?: FillerPhrases;
  slowNodes?: Record<string, FillerKind>;
}

/**
 * Decides, for one turn, when the caller hears a filler ("Let me check that
 * for you.") instead of silence while the reply is being prepared:
 * - as soon as the router picks a known-slow node;
 * - otherwise if nothing has been said `genericAfterMs` into the turn;
 * - once more if the caller is still waiting `stillWorkingAfterMs` after a filler.
 * At most two per turn; any reply text cancels everything still pending.
 * Call `dispose()` when the turn ends so no timer outlives it.
 */
export class FillerController {
  readonly sent: SentFiller[] = [];
  private readonly startedAt = Date.now();
  private readonly genericAfterMs: number;
  private readonly stillWorkingAfterMs: number;
  private readonly random: () => number;
  private readonly phrases: FillerPhrases;
  private readonly slowNodes: Record<string, FillerKind>;
  private genericTimer: NodeJS.Timeout | null = null;
  private stillWorkingTimer: NodeJS.Timeout | null = null;
  private finished = false;

  constructor(private readonly options: FillerControllerOptions) {
    this.genericAfterMs =
      options.genericAfterMs ?? readMs('FILLER_GENERIC_AFTER_MS', DEFAULT_GENERIC_AFTER_MS);
    this.stillWorkingAfterMs =
      options.stillWorkingAfterMs ??
      readMs('FILLER_STILL_WORKING_AFTER_MS', DEFAULT_STILL_WORKING_AFTER_MS);
    this.random = options.random ?? Math.random;
    this.phrases = options.phrases ?? FILLER_PHRASES;
    this.slowNodes = options.slowNodes ?? SLOW_NODE_FILLERS;
    if (options.isConversationStart) {
      this.finished = true;
    }
  }

  /** Arms the generic-filler timer; call when the turn starts. */
  start(): void {
    if (this.finished) return;
    this.genericTimer = setTimeout(() => {
      this.genericTimer = null;
      this.emit('generic');
    }, this.genericAfterMs);
  }

  /** The router picked `node`; speak right away if that node is slow. */
  onRoute(node: string): void {
    const kind = this.slowNodes[node];
    if (this.finished || !kind || this.sent.length > 0) return;
    this.emit(kind);
  }

  /** The reply has started — no more fillers this turn. */
  onReply(): void {
    this.finish();
  }

  dispose(): void {
    this.finish();
  }

  private emit(kind: FillerKind): void {
    if (this.finished || this.sent.length >= MAX_FILLERS_PER_TURN) return;
    this.clearGeneric();

    const text = this.pick(kind);
    if (!text) return;
    this.options.memory.lastPhrase = text;
    this.sent.push({ kind, text, atMs: Date.now() - this.startedAt });
    this.options.send(text);

    if (kind !== 'still_working' && !this.stillWorkingTimer) {
      this.stillWorkingTimer = setTimeout(() => {
        this.stillWorkingTimer = null;
        this.emit('still_working');
      }, this.stillWorkingAfterMs);
    }
  }

  private pick(kind: FillerKind): string | null {
    const all = this.phrases[kind]?.[this.options.language] ?? [];
    const fresh = all.filter((phrase) => phrase !== this.options.memory.lastPhrase);
    const pool = fresh.length > 0 ? fresh : all;
    if (pool.length === 0) return null;
    return pool[Math.floor(this.random() * pool.length)];
  }

  private clearGeneric(): void {
    if (this.genericTimer) {
      clearTimeout(this.genericTimer);
      this.genericTimer = null;
    }
  }

  private finish(): void {
    this.finished = true;
    this.clearGeneric();
    if (this.stillWorkingTimer) {
      clearTimeout(this.stillWorkingTimer);
      this.stillWorkingTimer = null;
    }
  }
}
