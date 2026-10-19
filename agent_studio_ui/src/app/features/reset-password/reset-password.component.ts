import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from '../../shared/auth-layout/auth-layout.component';
import { AuthService, ResetPasswordError } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

/** Matches the backend's `@MinLength(8)` password rule. */
export const MIN_PASSWORD_LENGTH = 8;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { newPassword, confirmPassword } = group.value as { newPassword: string; confirmPassword: string };
  return newPassword === confirmPassword ? null : { mismatch: true };
}

/** Landing page for the emailed reset link: `/reset-password?token=<token>`. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly minLength = MIN_PASSWORD_LENGTH;
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Backend rejected `newPassword` (shown inline under the field). */
  readonly passwordError = signal<string | null>(null);
  /** No token in the URL, or the backend rejected it as invalid/used/expired. */
  readonly linkInvalid = signal(!this.token);
  readonly showPassword = signal(false);

  constructor() {
    // A reset link is account recovery (possibly for another account): drop any existing
    // session so the page renders outside the app shell and `/login` is reachable after.
    if (this.authService.isAuthenticated()) {
      this.authService.logout();
    }
  }

  submit(): void {
    if (!this.token) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.passwordError.set(null);
    this.authService.resetPassword(this.token, this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Password updated. Sign in with your new password.');
        this.router.navigateByUrl('/login');
      },
      error: (err: ResetPasswordError) => {
        this.loading.set(false);
        if (err.reason === 'link') {
          this.linkInvalid.set(true);
        } else if (err.reason === 'password') {
          this.passwordError.set(err.message);
        } else {
          this.error.set(err.message);
        }
      },
    });
  }
}
