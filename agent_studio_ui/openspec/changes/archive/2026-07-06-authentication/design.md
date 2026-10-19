## Context

Angular 19 standalone app, no backend yet. All "API" calls in the codebase follow one convention (see `AgentService`): an in-memory mock array wrapped in `of(data).pipe(delay(300))`, exposed as an `Observable`. Routing is flat, lazy-loaded standalone components (`app.routes.ts`), with a `canDeactivate` guard already in place (`unsaved-changes.guard.ts`) as the precedent for functional guards. There is no user/session concept anywhere in `core/models` or `core/services`.

## Goals / Non-Goals

**Goals:**
- Gate every existing route behind a login check; nothing in `dashboard` or `agents/*` renders for an unauthenticated visitor.
- Provide a real-feeling (but mock) email/password login flow: form validation, a simulated async API call with latency, and error feedback on bad credentials.
- Persist the session across reloads via `localStorage`, matching how a real token-based session would behave, so the guard can be swapped for a real API later with minimal churn.
- Provide logout.

**Non-Goals:**
- No real backend/API integration, no password hashing, no signup/reset-password flows, no role/permission system. Single hardcoded credential pair only.
- No token refresh/expiry logic.

## Decisions

- **Functional guard (`authGuard: CanActivateFn`) over class-based guard** — matches the existing `unsavedChangesGuard` pattern already in `core/guards/`, which is a functional guard. Consistency over introducing a second style.
- **`AuthService` with a `BehaviorSubject<boolean>`/signal for `isAuthenticated`, exposing `login()`, `logout()`, `restoreSession()`** — mirrors `AgentService`'s `Observable`-returning style for `login()` (`of(...).pipe(delay(300))`) so it reads consistently with the rest of the codebase's mock services.
- **Session storage: `localStorage` key `lyreai_auth_session`, storing `{ email, token }`** — `token` is a fake string (`mock-token-<timestamp>`) generated client-side, since there's no backend to issue a real one. On app init, `AuthService` reads this key synchronously (constructor) to restore state before the router evaluates guards, avoiding a login flash for already-authenticated users.
- **Route protection via `canActivate`/`canActivateChild` on a wrapping parent route** rather than annotating each leaf route — added once at the routes-array level so future routes are protected by default instead of by opt-in.
- **Login route is a top-level route (`/login`) outside the guarded group**, plus a reverse check: if already authenticated and navigating to `/login`, redirect to `dashboard` (small inline check inside `authGuard` or a dedicated `guestGuard` — decide during implementation, default to reusing `authGuard` with a param/second guard for simplicity).
- **Credential check is hardcoded in `AuthService`** (`test@test.com` / `admin123`) rather than pulled from a mock JSON file — there's only one fixture record, so a dedicated mocks file would be overhead the existing `mocks/agents.mock.ts` pattern doesn't need for a single row.
- **Login screen styling reuses the existing global system, no new CSS variables or classes** — `src/styles/variables.css` already defines themed tokens (`--bg-*`, `--text-*`, `--border-color`, `--accent`, `--radius-*`, `--shadow-*`) for both `[data-theme='light']` and `[data-theme='dark']`, and `src/styles/globals.css` already provides `.card`, `.form-group`, `.label`, `.input`, `.btn`/`.btn-primary`. The login component composes these directly. Since `ThemeService` already toggles `data-theme` and persists the choice, dark/light support is automatic with zero extra work. Layout is deliberately minimal: one centered `.card` (logo/title, email field, password field, submit button, inline error) — no additional chrome, illustrations, or marketing content.

## Risks / Trade-offs

- [Mock auth is trivially bypassable via devtools/localStorage editing] → Acceptable: explicitly a placeholder per proposal; not a real security boundary yet.
- [Hardcoded credential in client source is visible in bundle] → Acceptable for a mock; call out clearly in code that this is temporary until a real backend exists.
- [Guarding at the route-array level could unintentionally block a future genuinely-public route] → Mitigation: keep `/login` (and any future public routes) explicitly outside the guarded parent group.

## Open Questions

- None blocking; real backend integration and credential storage will be revisited when an actual auth API exists.
