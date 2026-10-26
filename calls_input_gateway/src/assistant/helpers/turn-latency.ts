import { Logger } from '@nestjs/common';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Local wall-clock time as HH:MM:SS.mmm. */
export function clockTime(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}`;
}

const MAX_DETAIL_CHARS = 60;

/**
 * Latency trail for one agent turn. Every mark logs the wall-clock time and
 * the milliseconds since the turn started (the user's transcript arriving),
 * so grepping one `turn=` id reads as a timeline:
 *
 *   [Latency] 16:42:05.120 +0ms turn=3f2a9c1d#4 transcript ready "..."
 *   [Latency] 16:42:06.870 +1750ms turn=3f2a9c1d#4 agent first reply "..."
 *   [Latency] 16:42:06.874 +1754ms turn=3f2a9c1d#4 tts send #0 "..."
 *   [Latency] 16:42:07.300 +2180ms turn=3f2a9c1d#4 tts audio #0
 */
export class TurnLatency {
  private static readonly logger = new Logger('Latency');
  private readonly once = new Set<string>();

  constructor(
    readonly turnId: string,
    readonly startedAt: number = Date.now(),
  ) {}

  mark(event: string, detail?: string): void {
    const now = Date.now();
    const text = detail
      ? ` "${detail.length > MAX_DETAIL_CHARS ? `${detail.slice(0, MAX_DETAIL_CHARS)}…` : detail}"`
      : '';
    TurnLatency.logger.log(
      `${clockTime(new Date(now))} +${now - this.startedAt}ms turn=${this.turnId} ${event}${text}`,
    );
  }

  /** Marks `event` only the first time it's reported this turn. */
  markOnce(event: string, detail?: string): void {
    if (this.once.has(event)) return;
    this.once.add(event);
    this.mark(event, detail);
  }
}
