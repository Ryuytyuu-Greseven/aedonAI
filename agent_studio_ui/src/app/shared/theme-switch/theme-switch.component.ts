import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

/** Animated light/dark switch — a sliding knob with cross-fading sun and moon icons. */
@Component({
  selector: 'app-theme-switch',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-switch"
      (click)="themeService.toggle()"
      [class.theme-switch-dark]="themeService.theme() === 'dark'"
      [attr.aria-label]="themeService.theme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    >
      <span class="theme-switch-knob">
        <i class="fa-solid fa-sun theme-icon-sun" aria-hidden="true"></i>
        <i class="fa-solid fa-moon theme-icon-moon" aria-hidden="true"></i>
      </span>
    </button>
  `,
  styleUrl: './theme-switch.component.css',
})
export class ThemeSwitchComponent {
  readonly themeService = inject(ThemeService);
}
