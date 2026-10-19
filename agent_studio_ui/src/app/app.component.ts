import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavShellComponent } from './shared/nav-shell/nav-shell.component';
import { ToastComponent } from './shared/toast/toast.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavShellComponent, ToastComponent, ConfirmDialogComponent],
  template: `
    @if (authService.isAuthenticated()) {
      <app-nav-shell>
        <router-outlet />
      </app-nav-shell>
    } @else {
      <router-outlet />
    }
    <app-toast />
    <app-confirm-dialog />
  `,
})
export class AppComponent {
  protected readonly authService = inject(AuthService);
}
