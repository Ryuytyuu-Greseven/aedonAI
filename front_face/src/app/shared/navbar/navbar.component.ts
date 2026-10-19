import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from '../../core/theme.service';
import { SOLUTIONS } from '../../data/solutions.data';
import { LogoComponent } from '../logo.component';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, LogoComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  readonly themeService = inject(ThemeService);
  readonly solutions = SOLUTIONS;
  readonly scrolled = signal(false);
  readonly menuOpen = signal(false);
  readonly solutionsOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.closeAll());
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  @HostListener('document:keydown.escape')
  closeAll(): void {
    this.menuOpen.set(false);
    this.solutionsOpen.set(false);
  }
}
