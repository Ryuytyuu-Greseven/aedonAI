import { AgentCallSettings } from '../../schemas/agent.schema';

/** Defaults for agents saved before call settings existed (mirrors agent_studio_server). */
export const DEFAULT_CALL_SETTINGS: AgentCallSettings = {
  timezone: 'Asia/Kolkata',
  calling_hours_start: '09:00',
  calling_hours_end: '18:00',
  missed_call_retries: 0,
  missed_call_retry_gap_minutes: 360,
};

export function callSettingsOf(agent: { call_settings?: Partial<AgentCallSettings> | null }): AgentCallSettings {
  return { ...DEFAULT_CALL_SETTINGS, ...stripUndefined(agent.call_settings ?? {}) };
}

/** True when `date` falls inside the agent's calling hours, in the agent's time zone. */
export function isWithinCallingHours(date: Date, settings: AgentCallSettings): boolean {
  const { minutes } = localParts(date, settings.timezone);
  return minutes >= toMinutes(settings.calling_hours_start) && minutes < toMinutes(settings.calling_hours_end);
}

/**
 * `date` itself when it's inside calling hours; otherwise the next opening —
 * today's start if it's still early, tomorrow's start if the window has closed.
 */
export function nextCallingTime(date: Date, settings: AgentCallSettings): Date {
  const start = toMinutes(settings.calling_hours_start);
  const end = toMinutes(settings.calling_hours_end);
  const local = localParts(date, settings.timezone);
  if (local.minutes >= start && local.minutes < end) return date;

  const dayOffset = local.minutes < start ? 0 : 1;
  return zonedTimeToUtc(
    local.year,
    local.month,
    local.day + dayOffset,
    Math.floor(start / 60),
    start % 60,
    settings.timezone,
  );
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  /** Minutes since local midnight. */
  minutes: number;
}

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), minutes: get('hour') * 60 + get('minute') };
}

/** The UTC instant of a wall-clock time in `timeZone` (day/month overflow is normalized). */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Correct by the zone's offset, then once more in case that crossed a DST change.
  let result = asUtc - offsetMs(new Date(asUtc), timeZone);
  result = asUtc - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** How far `timeZone`'s wall clock is ahead of UTC at `date`. */
function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, Math.floor(p.minutes / 60), p.minutes % 60);
  return wallAsUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}
