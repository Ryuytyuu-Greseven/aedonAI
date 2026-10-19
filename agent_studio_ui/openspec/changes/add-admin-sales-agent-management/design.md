## Context

The app has one login (`/login`) backed by `AuthService`/`ApiService` hitting a real backend (`POST /api/auth/login`), with session `{ email, token }` persisted in `localStorage`. Route protection today is binary: `authGuard`/`guestGuard` only distinguish "has a session" from "doesn't." The backend does not yet return anything beyond `email`/`token`, and has no concept of multiple users or roles (`backend-openspec/specs/auth/spec.md` flags "user model... undecided" as an open question).

We need two roles sharing the one login form. Sales agents keep the entire existing app unchanged; the admin gets everything a sales agent gets, plus one additional screen for managing sales agent logins. The backend contract for roles/accounts isn't built yet.

## Goals / Non-Goals

**Goals:**
- Add `role: 'admin' | 'sales_agent'` to the session, surfaced by login.
- Gate exactly one route (`/admin`, the Sales Agents screen) to `admin` only; every other route stays gated only by "is authenticated," shared by both roles.
- Ship a working frontend end-to-end today via a mock layer, without waiting on backend work.
- Leave a clear, isolated seam so swapping the mock for real HTTP calls later touches one file, not the components/screens.
- Document the real contract for the backend team.

**Non-Goals:**
- Building the real backend endpoints (documented only, not implemented here).
- Password reset, email invites, or any account-recovery flow for sales agent logins.
- Fine-grained permissions beyond the two roles.
- Changing anything about how existing screens function for either role.

## Decisions

**1. Mock layer lives behind `ApiService`, not inside components.**
A small in-memory + `localStorage`-backed `mockAuthStore` (`src/app/core/http/mock-auth-store.ts`) that `ApiService`'s auth/admin methods consult. Components keep calling `authService.login(...)` / a new `AdminService` exactly as if it were real HTTP — only the service implementation is swapped. This matches the intended real contract 1:1, so replacing the mock later is a service-layer change only.
- Alternative considered: hardcode role logic directly in `AuthService`/components. Rejected — harder to rip out cleanly when backend ships, and mixes UI concerns with data-source concerns.

**2. Seed data, not a signup flow, for the first admin.**
The mock ships with one seeded admin account (`admin@lyreai.test` / a fixed password) and the existing `test@test.com` sales-agent account gets `role: 'sales_agent'`. Admin creates further sales-agent logins through a modal on the Sales Agents screen; the mock persists new accounts in `localStorage` (separate key from the session) so they survive reload within a browser, matching how the rest of the app already fakes persistence.

**3. Role-based routing is a single extra guard on one route, not a parallel route tree.**
`/admin` is a normal child route inside the same authenticated tree everything else lives in, gated by one additional `adminGuard` that checks `authService.role() === 'admin'`. No `salesAgentGuard` exists — sales agents and admins share the exact same `authGuard`-gated tree for every other route. This was **originally over-built as two disjoint route trees** (one per role) before this correction; that version incorrectly locked the admin out of the whole app. The corrected model is simpler and matches the actual requirement: one extra gated screen, not a parallel app.

**4. Login redirect target is always `/monitor`, for both roles.**
`LoginComponent` navigates to `/monitor` on success regardless of role — unchanged from before this feature. `guestGuard` (redirects an already-authenticated user away from `/login`) also always targets `/monitor`. There is no role branch here; the admin's extra destination is reached via nav, not via a different landing page.

**5. Nav Shell is one shared component; admin gets one extra nav item.**
`NavShellComponent` computes its nav item list from a shared base list, appending a "Sales Agents" entry (`/admin`) only when `role === 'admin'`. No structural/layout difference between roles — same flyout, same topbar, same avatar. This replaces an earlier version that rendered an entirely different "minimal shell" for admins (no flyout at all), which was wrong once admin access to the rest of the app was restored.

**6. Sales agent creation is a modal on the list screen, not a separate route.**
`SalesAgentListComponent` owns `showCreateForm`/`createEmail`/`createPassword` state and calls `AdminService.createSalesAgent()` directly, using the same `.modal-overlay`/`.modal.card` pattern as the existing "Create Knowledge Base" modal (`knowledge-base-list.component`) for visual consistency. This replaces an earlier separate `/admin/new` route + `AddSalesAgentComponent`, which added a page navigation for what is a single small form better suited to a modal.

## Risks / Trade-offs

- [Mock diverges from eventual real API shape] → Mock methods on `ApiService` return the exact response/request shapes documented in the updated `backend-openspec/specs/auth/spec.md`, so integrating the real backend later is a drop-in swap of the HTTP call, not a redesign.
- [Sales-agent accounts only persist in one browser's `localStorage`] → Acceptable for a frontend-only mock stage; called out explicitly in the mock's code comment and in the backend-openspec doc so nobody mistakes it for real multi-user storage.
- [A mock-token session hitting a real-backend screen (dashboard/monitor/etc.) always 401s, since the real backend has never heard of it] → Confirmed in browser testing: without a fix, the shared `authInterceptor` treated that 401 as "session expired" and force-logged the user out on their very first real screen. This is now the default experience for BOTH roles once they hit any real-backend screen with a mock account (previously only a concern for admin-created sales agents, back when admin never touched those screens). Fixed by having the interceptor recognize the `mock-token:` prefix and skip the auto-logout/redirect for those sessions (`src/app/core/interceptors/auth.interceptor.ts`) — the individual failed request still surfaces its own error/toast, but the session and role are preserved. Real backend-driven data simply won't load for a mock account (the seeded admin, or an admin-created sales agent) until the backend implements real multi-user support; this is the accepted cost of "mock for now."
- [Direct URL navigation to `/admin` by a non-admin] → `adminGuard` redirects to `/monitor` rather than `/login`, so a misrouted authenticated user lands somewhere valid instead of bouncing to login.
- [Naming collision with existing "sales agent" voice-agent type] → Restricted to the `role` value and internal identifiers; user-facing copy on the admin's screen says "Sales Team Accounts" / "Add Sales Agent Login" to stay unambiguous to admins reading the screen.
- [Local dev server file-watcher can silently go stale after many rapid edits] → Observed while verifying this change: `ng serve`'s Vite-based watcher stopped picking up further file changes after a burst of edits, continuing to serve an old build (including a deleted component) with no error surfaced. Not an app bug, but worth knowing when testing locally — if the browser shows behavior that doesn't match the current source, restart `ng serve` before assuming the code is wrong.

## Migration Plan

Frontend-only, no data migration (no real users exist yet). Roll out as a single change; if issues arise, revert the change (the `adminGuard` on `/admin` and the extra nav item are additive, not destructive to existing behavior for either role).

## Superseded: mock layer removed, real backend wired (see `/logins.md`)

The backend team shipped the real auth + frontline-agents API, documented at the repo root in `logins.md`. Everything described above as "mocked" (Decisions 1–2, and the mock-related Risks) is now removed:

- `mock-auth-store.ts` and `auth-storage.const.ts` (the `MOCK_TOKEN_PREFIX`-based interceptor bypass) are deleted entirely. `ApiService.login/logout/getSession` are plain passthroughs to `POST/GET /api/auth/*`.
- `UserRole` changed from `'admin' | 'sales_agent'` to `'admin' | 'agent'` to match the real backend's role string exactly — this was a required correctness fix, not a style choice, since a mismatched literal would silently never match.
- `AuthSession` gained `name` (the backend returns it, though the one long-lived `test@test.com` seed account in the local dev backend currently omits it — harmless, since nothing renders it yet).
- Frontline-agent actions (enable/disable/rename/reset-password) are keyed by the account's `id` (`GET /api/frontline-agents` returns full user objects), not email — `SalesAgentAccount` gained an `id` field and a new `frontline-agent-mapper.ts` translates the wire shape (`isDisabled`, full user object) to the frontend's slimmer model.
- Password minimums changed from the mock's 6 characters to the real backend's 8, for both account creation and password reset.
- `resetSalesAgentPassword` now returns `Observable<void>` (backend responds `204` with no body) instead of the mock's fabricated updated-account object.
- `authInterceptor`'s mock-session bypass is removed — a real token's 401 genuinely means "log out," so the interceptor reverted to its pre-mock unconditional behavior.
- `AuthService.validateSession()` now also refreshes `email`/`name`/`role` from the `/auth/session` response (see the new `user-auth` requirement "Session Restore Refreshes Identity") — previously pointless since the mock's `SessionResponse` was just `{ email }`.
- Verified against the real locally-running backend (not just a further mock): login, session-restore-on-reload, logout (token revocation), and invalid-credential rejection all confirmed working end-to-end for an `agent`-role account. **Not verified**: the `admin`-only Sales Agents screen and its create/list/enable/disable/rename/reset-password actions, since no admin credential was available in this environment — these are wired to the documented contract but need a real admin login to confirm end-to-end.

`backend-openspec/specs/auth/spec.md` now just points to `logins.md` as the authoritative contract instead of duplicating a now-stale proposed shape.

## Open Questions

- **Admin-only screen not yet verified against the real backend** — needs an admin credential; see above.
- Multi-company scoping (`companyId`) is `null` everywhere today per `logins.md` — nothing for the frontend to do differently yet, but worth revisiting once populated.
