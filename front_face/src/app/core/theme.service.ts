import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'aedon-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Initial value is set pre-bootstrap by the inline script in index.html. */
  readonly theme = signal<Theme>(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Storage can be unavailable (private mode); the theme still applies for this visit.
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}
