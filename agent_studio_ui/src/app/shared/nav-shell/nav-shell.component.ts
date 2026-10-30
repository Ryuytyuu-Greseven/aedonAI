import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyCode, CurrencyService } from '../../core/services/currency.service';
import { ThemeSwitchComponent } from '../theme-switch/theme-switch.component';
import { AccountMenuComponent } from './account-menu/account-menu.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-nav-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, ThemeSwitchComponent, AccountMenuComponent],
  templateUrl: './nav-shell.component.html',
  styleUrl: './nav-shell.component.css',
  host: {
    '[class.nav-expanded]': 'railExpanded()',
  },
})
export class NavShellComponent {
  private static readonly STORAGE_KEY = 'aedon_nav_sticky';
  readonly currencyService = inject(CurrencyService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly baseNavItems: NavItem[] = [
    { path: '/monitor', label: 'Monitor Agents', icon: 'fa-solid fa-chart-line' },
    { path: '/dashboard', label: 'All Agents', icon: 'fa-solid fa-gauge-high' },
    { path: '/playground', label: 'Playground', icon: 'fa-solid fa-sliders' },
    { path: '/knowledge-base', label: 'Knowledge Base', icon: 'fa-solid fa-book' },
    { path: '/phone-numbers', label: 'Phone Numbers', icon: 'fa-solid fa-phone' },
  ];

  private readonly adminNavItems: NavItem[] = [
    { path: '/admin', label: 'Sales Agents', icon: 'fa-solid fa-user-shield' },
    { path: '/admin-settings', label: 'Admin Settings', icon: 'fa-solid fa-gear' },
  ];

  /** Admins get everything sales agents get, plus destinations for managing sales agent logins and org settings. */
  readonly isAdmin = computed(() => this.authService.role() === 'admin');

  readonly navGroups = computed<NavGroup[]>(() =>
    this.isAdmin()
      ? [
          { label: 'Workspace', items: this.baseNavItems },
          { label: 'Admin', items: this.adminNavItems },
        ]
      : [{ label: 'Workspace', items: this.baseNavItems }],
  );

  readonly railExpanded = signal<boolean>(
    typeof window !== 'undefined' && window.innerWidth >= 1024
      ? localStorage.getItem(NavShellComponent.STORAGE_KEY) === 'true'
      : false,
  );

  private readonly url = signal(this.router.url);

  /** Title of the section the user is in, shown next to the brand in the top bar. */
  readonly currentSection = computed(() => {
    const url = this.url();
    if (url.startsWith('/profile')) return { label: 'Profile', icon: 'fa-solid fa-id-badge' };
    const all = [...this.baseNavItems, ...this.adminNavItems];
    // Longest match first so /admin-settings doesn't resolve to /admin.
    return [...all].sort((a, b) => b.path.length - a.path.length).find((i) => url.startsWith(i.path)) ?? null;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => e.urlAfterRedirects),
        takeUntilDestroyed(),
      )
      .subscribe((url) => {
        this.url.set(url);
        // Only close sidebar automatically on mobile/tablet drawer viewports
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          this.railExpanded.set(false);
        }
      });
  }

  @HostListener('document:keydown.escape')
  closeRail(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.railExpanded.set(false);
    }
  }

  closeRailMobile(): void {
    this.railExpanded.set(false);
  }

  toggleRail(): void {
    this.railExpanded.update((v) => {
      const next = !v;
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        localStorage.setItem(NavShellComponent.STORAGE_KEY, String(next));
      }
      return next;
    });
  }

  setCurrency(currency: CurrencyCode): void {
    this.currencyService.setCurrency(currency);
  }
}
