import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

/** Hexagon avatar (first letter of the user's name) that opens the profile / settings / logout menu. */
@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-menu.component.html',
  styleUrl: './account-menu.component.css',
})
export class AccountMenuComponent {
  readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly expanded = signal(false);

  readonly isAdmin = computed(() => this.authService.role() === 'admin');
  readonly name = computed(() => this.authService.session()?.name ?? '');
  readonly email = computed(() => this.authService.session()?.email ?? '');
  readonly roleLabel = computed(() => (this.isAdmin() ? 'Admin' : 'Sales agent'));
  readonly initial = computed(() => (this.name() || this.email()).charAt(0).toUpperCase() || '?');

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.expanded.set(false);
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
