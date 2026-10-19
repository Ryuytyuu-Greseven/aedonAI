## 1. Auth Model & Service

- [x] 1.1 Create `src/app/core/models/auth.model.ts` with `AuthSession` (`email`, `token`) and `LoginCredentials` (`email`, `password`) types.
- [x] 1.2 Create `src/app/core/services/auth.service.ts`: `login(credentials): Observable<AuthSession>` (mock API via `of(...).pipe(delay(300))`, validates against `test@test.com` / `admin123`, else `throwError`), `logout(): void`, `isAuthenticated()` signal/observable, `restoreSession()` read from `localStorage` on construction.
- [x] 1.3 Persist/clear session under `localStorage` key `aedonai_auth_session` on login/logout.

## 2. Route Guard

- [x] 2.1 Create `src/app/core/guards/auth.guard.ts` — functional `CanActivateFn` (`authGuard`) redirecting to `/login` when unauthenticated.
- [x] 2.2 Create `guestGuard` (or reuse `authGuard` with inverted param) to redirect an authenticated user away from `/login` to `/dashboard`.

## 3. Login Feature

- [x] 3.1 Scaffold `src/app/features/login/login.component.ts` (+ `.html`/`.css`) as a standalone component with a reactive form (email, password) and validation (required, email format).
- [x] 3.2 Build the template as a single centered `.card` using existing global classes only (`.form-group`, `.label`, `.input`, `.btn`/`.btn-primary`) — no new CSS variables, no bespoke colors/borders/radii. Keep it minimal: title, two fields, submit button, inline error text. No illustrations or extra chrome.
- [x] 3.3 Verify the screen in both themes (toggle `data-theme` via `ThemeService`) — it should pick up light/dark automatically through the existing `variables.css` tokens with no component-specific overrides.
- [x] 3.4 Wire submit to `AuthService.login()`; show a loading state during the simulated API delay and an inline error message on failure.
- [x] 3.5 On success, navigate to `/dashboard`.

## 4. Routing Integration

- [x] 4.1 Add `/login` route in `src/app/app.routes.ts` guarded by `guestGuard`, outside the protected route group.
- [x] 4.2 Wrap existing routes (`dashboard`, `agents/new`, `agents/:id`, and the `''`/`**` redirects) under `authGuard` (`canActivate`/`canActivateChild`) so none render without a session.

## 5. Logout & Shell Integration

- [x] 5.1 Add a logout control to `src/app/shared/app-shell/app-shell.component.ts/.html` that calls `AuthService.logout()` and navigates to `/login`.
- [x] 5.2 Ensure `app-shell` (and its logout control) only renders for authenticated routes, not on `/login`.

## 6. Verification

- [x] 6.1 Manually verify: fresh load with no session → redirected to `/login`; wrong credentials → error shown; correct credentials (`test@test.com` / `admin123`) → lands on `/dashboard`.
- [x] 6.2 Manually verify: reload while authenticated stays logged in; logout clears session and blocks direct navigation back to `/dashboard`.
- [x] 6.3 Run `ng build` / existing test suite to confirm no regressions.
