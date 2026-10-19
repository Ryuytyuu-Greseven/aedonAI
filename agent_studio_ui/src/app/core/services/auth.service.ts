import { Injectable, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { AuthSession, LoginCredentials } from '../models/auth.model';
import { ApiService } from '../http/api.service';

const STORAGE_KEY = 'aedonai_auth_session';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Where a failed reset should surface: inline on the password field, or as a dead link. */
export type ResetPasswordFailure = 'password' | 'link' | 'unknown';

export class ResetPasswordError extends Error {
  constructor(
    readonly reason: ResetPasswordFailure,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Per `/reset_pass.md`: both failures are 400 — field validation sends a `string[]`
 * naming the field, an invalid/used/expired token sends a plain string.
 */
function toResetPasswordError(error: unknown): ResetPasswordError {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return new ResetPasswordError('unknown', GENERIC_ERROR);
  }
  const message: unknown = error.error?.message;
  if (Array.isArray(message) && message.some((m) => String(m).startsWith('newPassword'))) {
    return new ResetPasswordError('password', 'Password must be at least 8 characters.');
  }
  return new ResetPasswordError('link', 'This link is invalid or has expired.');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<AuthSession | null>(this.restoreSession());
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed(() => this.session()?.role ?? null);

  constructor(private readonly api: ApiService) {}

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.api.login(credentials).pipe(
      tap((session) => this.setSession(session)),
      catchError((error: unknown) => {
        const message =
          error instanceof HttpErrorResponse
            ? (error.error?.message ?? 'Invalid email or password')
            : 'Login failed';
        return throwError(() => new Error(message));
      }),
    );
  }

  /** Always succeeds for unknown emails (no enumeration); 400 = bad email, 500 = mail send failed. */
  forgotPassword(email: string): Observable<void> {
    return this.api.forgotPassword({ email }).pipe(
      map(() => undefined),
      catchError((error: unknown) => {
        const message =
          error instanceof HttpErrorResponse && error.status === 400 ? 'Enter a valid email address.' : GENERIC_ERROR;
        return throwError(() => new Error(message));
      }),
    );
  }

  /** Errors with a {@link ResetPasswordError}. Does not sign in — the user logs in afterwards. */
  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api.resetPassword({ token, newPassword }).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => toResetPasswordError(error))),
    );
  }

  logout(): void {
    const hadSession = this.session() !== null;
    this.clearSession();
    if (hadSession) {
      this.api.logout().pipe(catchError(() => of(undefined))).subscribe();
    }
  }

  /**
   * Validates the restored session against the server; clears it if stale. Used once at
   * app startup. Also refreshes email/name/role from the response — the backend resolves
   * role fresh on every request, so this picks up a role change or rename immediately
   * instead of waiting for the next login.
   */
  validateSession(): Observable<void> {
    const current = this.session();
    if (!current) {
      return of(undefined);
    }
    return this.api.getSession().pipe(
      tap((identity) => this.setSession({ ...current, ...identity })),
      map(() => undefined),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
    );
  }

  clearSession(): void {
    this.setSession(null);
  }

  private setSession(session: AuthSession | null): void {
    this.session.set(session);
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private restoreSession(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }
}
