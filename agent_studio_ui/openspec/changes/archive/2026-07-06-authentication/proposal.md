## Why

The app currently has no authentication — the router redirects straight to `dashboard` and every route renders unconditionally. Any user (or anyone with the URL) can view and edit agents. We need a login gate so no screen renders until a user has authenticated, establishing the foundation that real auth will later replace.

## What Changes

- Add a login screen (`/login`) that collects email and password.
- Add a mock `AuthService` that simulates an API call (`of(...).pipe(delay(...))`) and validates against a single hardcoded credential pair: `test@test.com` / `admin123`.
- On successful login, persist a mock session (email + fake token) to `localStorage` so a page refresh keeps the user logged in.
- Add an `authGuard` (`CanActivate`/`CanActivateChild`) that blocks all existing routes (`dashboard`, `agents/new`, `agents/:id`) until a session exists, redirecting unauthenticated users to `/login`.
- Add a logout action (button in the app shell) that clears the session and redirects to `/login`.
- Redirect an already-authenticated user away from `/login` back to `dashboard`.

## Capabilities

### New Capabilities
- `user-auth`: Email/password login, mock authentication API, session persistence, route protection, and logout.

### Modified Capabilities
(none — no existing spec's requirements change; the app shell gains a logout affordance but that's implementation detail of the new capability, not a change to another capability's requirements)

## Impact

- **Affected code**: `src/app/app.routes.ts` (new `/login` route, guard on existing routes), `src/app/app.component.ts`/app-shell (logout control, conditional shell rendering), new `src/app/core/services/auth.service.ts`, new `src/app/core/guards/auth.guard.ts`, new `src/app/features/login/` feature component.
- **Dependencies**: none new — uses existing Angular Forms/Router/RxJS already in `package.json`.
- **Systems**: purely client-side/mock for now; no backend exists yet, so this is a placeholder mechanism to be swapped for a real API later.
