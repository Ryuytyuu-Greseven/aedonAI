import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Local wall-clock time as HH:MM:SS.mmm. */
export function clockTime(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}.${pad(at.getMilliseconds(), 3)}`;
}

const MAX_TEXT_CHARS = 60;

/**
 * Trace id for one turn: the gateway's own turn id when it sends one
 * (`traceId`, the same id as its `[Latency] turn=` lines), else a fresh one.
 */
export function resolveTraceId(msg: { traceId?: unknown }): string {
  return typeof msg.traceId === 'string' && msg.traceId ? msg.traceId : `lb-${randomUUID().slice(0, 8)}`;
}

/**
 * One turn's IN/OUT timeline on this server, each line with the wall-clock
 * time and ms since the message came IN:
 *
 *   [Trace] 16:42:05.123 +0ms trace=3f2a9c1d#4 IN message "..."
 *   [Trace] 16:42:06.010 +887ms trace=3f2a9c1d#4 -- route Banter_Node
 *   [Trace] 16:42:07.420 +2297ms trace=3f2a9c1d#4 OUT token "..."
 *   [Trace] 16:42:07.421 +2298ms trace=3f2a9c1d#4 OUT done
 */
export class TurnTrace {
  private static readonly logger = new Logger('Trace');
  readonly startedAt = Date.now();

  constructor(readonly traceId: string) {}

  in(type: string, text?: string): void {
    this.log('IN', type, text);
  }

  out(type: string, text?: string): void {
    this.log('OUT', type, text);
  }

  /** Something that happened inside the turn (not a message). */
  note(event: string, detail?: string): void {
    this.log('--', event, detail);
  }

  private log(direction: string, what: string, text?: string): void {
    const now = Date.now();
    const quoted = text
      ? ` "${text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}…` : text}"`
      : '';
    TurnTrace.logger.log(
      `${clockTime(new Date(now))} +${now - this.startedAt}ms trace=${this.traceId} ${direction} ${what}${quoted}`,
    );
  }
}
