import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** One IANA zone, with everything a search can match against. */
interface TimeZoneOption {
  id: string;
  /** "New York", "Kolkata". */
  city: string;
  /** "America", "Asia" (blank for UTC). */
  region: string;
  /** "GMT+05:30". */
  offset: string;
  offsetMinutes: number;
  /** "India Standard Time" — empty when the browser only knows "GMT+5:30". */
  longName: string;
  /** Lower-cased text every query word is looked for in. */
  haystack: string;
}

/** A label split into plain and matched runs, for highlighting. */
interface Segment {
  text: string;
  match: boolean;
}

/** Fallback when the browser can't list zones (Intl.supportedValuesOf is missing). */
const COMMON_TIME_ZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Kuala_Lumpur',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Dublin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'UTC',
];

/** Most rows the panel shows; typing narrows the rest down. */
const MAX_RESULTS = 5;

/** Panel position in viewport pixels (it's `position: fixed`, so no card can clip it). */
interface PanelPosition {
  left: number;
  width: number;
  /** One of top/bottom is set: below the field, or above it when there's no room below. */
  top: number | null;
  bottom: number | null;
}

let nextId = 0;

/**
 * Searchable IANA time zone picker for reactive forms. Typing matches anywhere in a zone's city,
 * region, full name or UTC offset ("york", "india standard", "+5:30", "gmt-8"), words in any order.
 * Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
 */
@Component({
  selector: 'app-timezone-picker',
  standalone: true,
  templateUrl: './timezone-picker.component.html',
  styleUrl: './timezone-picker.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimezonePickerComponent), multi: true }],
})
export class TimezonePickerComponent implements ControlValueAccessor, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Put on the trigger button, so a `<label for>` points at it. */
  readonly inputId = input(`tz-picker-${nextId++}`);
  readonly listId = computed(() => `${this.inputId()}-list`);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly value = signal('');
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(0);
  readonly disabled = signal(false);

  /** Built on first open — formatting ~400 zones isn't free. */
  private readonly options = signal<TimeZoneOption[]>([]);

  readonly selected = computed(() => {
    const id = this.value();
    return this.options().find((o) => o.id === id) ?? (id ? describeZone(id) : null);
  });

  private readonly words = computed(() => normalize(this.query()).split(' ').filter(Boolean));

  /** Every zone matching the query, best first. */
  private readonly matches = computed(() => {
    const words = this.words();
    const options = this.options();
    if (words.length === 0) return suggestions(options, this.value());
    return options
      .filter((o) => words.every((w) => o.haystack.includes(w)))
      .map((o) => ({ o, rank: rankMatch(o, words[0]) }))
      .sort((a, b) => a.rank - b.rank || a.o.offsetMinutes - b.o.offsetMinutes || a.o.city.localeCompare(b.o.city))
      .map(({ o }) => o);
  });

  /** What the panel lists: the first MAX_RESULTS matches. */
  readonly results = computed(() => this.matches().slice(0, MAX_RESULTS));
  readonly matchCount = computed(() => this.matches().length);
  readonly searching = computed(() => this.words().length > 0);
  readonly totalZones = computed(() => this.options().length);

  readonly position = signal<PanelPosition | null>(null);
  private readonly reposition = () => this.updatePosition();

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ── ControlValueAccessor ────────────────────────────────

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  // ── Interaction ─────────────────────────────────────────

  toggle(): void {
    if (this.open()) this.close();
    else this.openPanel();
  }

  openPanel(): void {
    if (this.disabled()) return;
    if (this.options().length === 0) this.options.set(buildOptions(this.value()));
    this.query.set('');
    this.updatePosition();
    this.open.set(true);
    // Follow the field while the page scrolls (any scroll container) or resizes.
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
    const index = this.results().findIndex((o) => o.id === this.value());
    this.activeIndex.set(Math.max(0, index));
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
    this.onTouched();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }

  /** Places the panel under the field, or above it when the viewport has more room there. */
  private updatePosition(): void {
    const trigger = this.host.nativeElement.querySelector<HTMLElement>('.tz-trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const panelHeight = 340; // search + 5 rows + footer
    const width = Math.min(Math.max(rect.width, 320), 440, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const below = window.innerHeight - rect.bottom;
    const openUp = below < panelHeight && rect.top > below;
    this.position.set({
      left,
      width,
      top: openUp ? null : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : null,
    });
  }

  onQuery(text: string): void {
    this.query.set(text);
    this.activeIndex.set(0);
  }

  pick(option: TimeZoneOption): void {
    if (option.id !== this.value()) {
      this.value.set(option.id);
      this.onChange(option.id);
    }
    this.close();
    this.host.nativeElement.querySelector<HTMLButtonElement>('.tz-trigger')?.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.activeIndex.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.update((i) => (i - 1 + count) % count);
        break;
      case 'Enter': {
        event.preventDefault();
        const option = this.results()[this.activeIndex()];
        if (option) this.pick(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.host.nativeElement.querySelector<HTMLButtonElement>('.tz-trigger')?.focus();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  optionId(index: number): string {
    return `${this.listId()}-${index}`;
  }

  /** Splits `text` into runs, marking where any query word matches (case-insensitive). */
  highlight(text: string): Segment[] {
    const words = this.words();
    if (!text || words.length === 0) return [{ text, match: false }];
    // Same length as `text`, so match positions line up with it.
    const lower = text.toLowerCase().replace(/[_/]/g, ' ');
    const marks = new Array<boolean>(text.length).fill(false);
    for (const word of words) {
      for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + 1)) {
        for (let i = at; i < at + word.length && i < marks.length; i++) marks[i] = true;
      }
    }
    const segments: Segment[] = [];
    for (let i = 0; i < text.length; i++) {
      const last = segments[segments.length - 1];
      if (last && last.match === marks[i]) last.text += text[i];
      else segments.push({ text: text[i], match: marks[i] });
    }
    return segments;
  }
}

// ── Zone data ─────────────────────────────────────────────

function buildOptions(current: string): TimeZoneOption[] {
  const ids = listTimeZones();
  if (current && !ids.includes(current)) ids.unshift(current);
  return ids
    .map(describeZone)
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city));
}

/** Shown before anything is typed: the current zone, then widely used ones. */
function suggestions(options: TimeZoneOption[], current: string): TimeZoneOption[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  const ids = [current, ...COMMON_TIME_ZONES].filter((id, i, all) => id && all.indexOf(id) === i);
  return ids
    .map((id) => byId.get(id))
    .filter((o): o is TimeZoneOption => !!o)
    .slice(0, MAX_RESULTS);
}

/** Lower is better: city starts with the first word, then city contains it, then anything else. */
function rankMatch(option: TimeZoneOption, word: string): number {
  const city = normalize(option.city);
  if (city.startsWith(word) || city.split(' ').some((part) => part.startsWith(word))) return 0;
  if (city.includes(word)) return 1;
  if (normalize(option.region).startsWith(word)) return 2;
  if (normalize(option.longName).includes(word)) return 3;
  return 4;
}

function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  try {
    const zones = intl.supportedValuesOf?.('timeZone');
    if (zones?.length) return zones.includes('UTC') ? [...zones] : [...zones, 'UTC'];
  } catch {
    // fall through to the short list
  }
  return [...COMMON_TIME_ZONES];
}

function describeZone(id: string): TimeZoneOption {
  const parts = id.split('/');
  const city = (parts.length > 1 ? parts.slice(1).join(' / ') : parts[0]).replace(/_/g, ' ');
  const region = parts.length > 1 ? parts[0].replace(/_/g, ' ') : '';
  const offsetMinutes = zoneOffsetMinutes(id);
  const offset = formatOffset(offsetMinutes);
  const longName = zoneName(id, 'long');
  const shortName = zoneName(id, 'short');

  // Offsets are searchable as "+05:30", "+5:30", "+530", "gmt+5:30" and "utc+5:30".
  const sign = offsetMinutes < 0 ? '-' : '+';
  const h = Math.floor(Math.abs(offsetMinutes) / 60);
  const m = Math.abs(offsetMinutes) % 60;
  const mm = String(m).padStart(2, '0');
  const offsetForms = [`${sign}${String(h).padStart(2, '0')}:${mm}`, `${sign}${h}:${mm}`, `${sign}${h}${m ? mm : ''}`];
  const haystack = normalize(
    [id, city, region, longName, shortName, ...offsetForms, ...offsetForms.map((o) => `gmt${o}`), ...offsetForms.map((o) => `utc${o}`)].join(' '),
  );

  return { id, city, region, offset, offsetMinutes, longName: /^GMT[+-]/.test(longName) ? '' : longName, haystack };
}

function zoneOffsetMinutes(timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(new Date());
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((wall - Math.floor(Date.now() / 60_000) * 60_000) / 60_000);
  } catch {
    return 0;
  }
}

function zoneName(timeZone: string, style: 'long' | 'short'): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: style })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return 'GMT';
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  return `GMT${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** Lower-case and treat "_" and "/" as spaces, so "new york" finds America/New_York. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[_/]/g, ' ').replace(/\s+/g, ' ').trim();
}
