import { Component, OnDestroy, ViewEncapsulation, inject, signal } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import {
  SHOWCASE_AGENTS,
  SHOWCASE_COUNTERS,
  SHOWCASE_EVENTS,
  SHOWCASE_VERBS,
  ShowcaseEvent,
} from '../../../mocks/auth-showcase.mock';

const FEED_SIZE = 3;
const FEED_INTERVAL_MS = 2600;
const VERB_INTERVAL_MS = 2800;
const WAVE_BARS = 56;

/**
 * Branded split-screen shell for the logged-out pages (login, forgot/reset password).
 * The left panel is a purely decorative "live fleet" animation; the right panel hosts the projected form.
 * Styles are unencapsulated (all `login-*` prefixed) so the projected forms can use them.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class AuthLayoutComponent implements OnDestroy {
  readonly themeService = inject(ThemeService);

  readonly agents = SHOWCASE_AGENTS;
  readonly verbs = SHOWCASE_VERBS;
  readonly waveBars = Array.from({ length: WAVE_BARS }, (_, i) => ({
    angle: (360 / WAVE_BARS) * i,
    delay: (i * 97) % 1300,
  }));
  readonly year = new Date().getFullYear();

  readonly verbIndex = signal(0);
  readonly counters = signal(SHOWCASE_COUNTERS.map((c) => ({ label: c.label, value: c.start })));
  /** Newest first; each entry carries a unique key so @for animates only the new arrival. */
  readonly feed = signal<(ShowcaseEvent & { key: number })[]>(
    SHOWCASE_EVENTS.slice(0, FEED_SIZE).map((e, i) => ({ ...e, key: i })).reverse(),
  );

  private nextEvent = FEED_SIZE;
  private readonly timers: ReturnType<typeof setInterval>[] = [];

  constructor() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.timers.push(
      setInterval(() => this.pushEvent(), FEED_INTERVAL_MS),
      setInterval(() => this.verbIndex.update((i) => (i + 1) % this.verbs.length), VERB_INTERVAL_MS),
    );
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearInterval);
  }

  iconClass(icon: string): string {
    return icon.startsWith('fa-brands') ? icon : `fa-solid ${icon}`;
  }

  private pushEvent(): void {
    const event = SHOWCASE_EVENTS[this.nextEvent % SHOWCASE_EVENTS.length];
    const key = this.nextEvent++;
    this.feed.update((items) => [{ ...event, key }, ...items].slice(0, FEED_SIZE));
    this.counters.update((items) =>
      items.map((c, i) => ({ ...c, value: c.value + Math.ceil(Math.random() * SHOWCASE_COUNTERS[i].step) })),
    );
  }
}
