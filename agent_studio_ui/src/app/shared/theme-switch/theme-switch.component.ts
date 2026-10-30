import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

/** Animated light/dark slider switch with sliding knob and rotating sun/moon icons. */
@Component({
  selector: 'app-theme-switch',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-slider"
      (click)="themeService.toggle()"
      [class.theme-slider-dark]="themeService.theme() === 'dark'"
      [attr.aria-label]="themeService.theme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
      [attr.title]="themeService.theme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
    >
      <span class="theme-slider-knob">
        <i class="fa-solid fa-sun theme-icon theme-sun" aria-hidden="true"></i>
        <i class="fa-solid fa-moon theme-icon theme-moon" aria-hidden="true"></i>
      </span>
    </button>
  `,
  styleUrl: './theme-switch.component.css',
})
export class ThemeSwitchComponent {
  readonly themeService = inject(ThemeService);
}
