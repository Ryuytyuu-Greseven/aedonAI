## 1. Data model & mock layer

- [x] 1.1 Add `role: 'admin' | 'sales_agent'` to `AuthSession` in `src/app/core/models/auth.model.ts`.
- [x] 1.2 Add a `SalesAgentAccount` model (email, enabled/disabled, createdAt) in `src/app/core/models`.
- [x] 1.3 Create a mock auth/admin data store (in-memory + `localStorage`-backed, separate storage key from the session) seeded with `test@test.com`/`admin123` (`sales_agent`) and `admin@lyreai.test`/`admin123` (`admin`).
- [x] 1.4 Wire `ApiService.login()` to resolve against the mock store (matching the real `POST /api/auth/login` response shape plus `role`), simulating latency and rejecting disabled accounts.
- [x] 1.5 Add `ApiService` methods (mock-backed) for: create sales agent account, list sales agent accounts, disable/enable a sales agent account — matching the endpoint shapes documented in task 6.

## 2. Auth service & guards

- [x] 2.1 Update `AuthService` types/usages to carry `role` through `session`/`isAuthenticated`.
- [x] 2.2 Add `adminGuard` (session role must be `admin`, else redirect to `/monitor`) and `salesAgentGuard` (session role must be `sales_agent`, else redirect to `/admin`) in `src/app/core/guards/auth.guard.ts`.
- [x] 2.3 Update `guestGuard` to redirect an authenticated user to `/admin` or `/monitor` based on role instead of always `/monitor`.

## 3. Routing

- [x] 3.1 In `src/app/app.routes.ts`, apply `salesAgentGuard` to the existing top-level authenticated route tree (dashboard, playground, monitor, knowledge-base, phone-numbers, agents).
- [x] 3.2 Add a new `/admin` route tree guarded by `adminGuard`, with child routes for the sales agent list (default) and the add-sales-agent screen.
- [x] 3.3 Update `LoginComponent.submit()` to navigate to `/admin` or `/monitor` based on the returned session's `role`.

## 4. Nav shell

- [x] 4.1 Update `NavShellComponent` to read `role` from `AuthService` and conditionally render the flyout rail only for `sales_agent`.
- [x] 4.2 Render the minimal admin shell (product mark, theme toggle, profile avatar/logout, no flyout) when `role` is `admin`.

## 5. Admin Panel screens

- [x] 5.1 Scaffold `src/app/features/admin-panel/` with a sales-agent list screen and an add-sales-agent screen (standalone components, consistent with existing feature module patterns).
- [x] 5.2 Sales agent list screen: table/list of accounts with email, enabled/disabled status, and a toggle action; empty state when no accounts exist.
- [x] 5.3 Add-sales-agent screen: reactive form (email + password), validation, duplicate-email inline error, success confirmation, then return to the list.
- [x] 5.4 Use "Sales Team Accounts" / "Add Sales Agent Login" copy (avoid confusion with the existing voice-agent "sales agent" template naming).

## 6. Backend contract docs

- [x] 6.1 Update `backend-openspec/specs/auth/spec.md`: `POST /api/auth/login` response gains `role`; note the disabled-account 401 case.
- [x] 6.2 Add endpoints to `backend-openspec/specs/auth/spec.md` (or a new `backend-openspec/specs/sales-agent-accounts/spec.md`) for admin create/list/disable/enable of sales agent accounts, matching the mock's request/response shapes from task 1.5.

## 7. Verification

- [x] 7.1 Manually verify: sales agent login reaches `/monitor` and all existing screens, `/admin` redirects away.
- [x] 7.2 Manually verify: admin login reaches `/admin` only, all existing screens redirect back to `/admin`.
- [x] 7.3 Manually verify: admin can create a sales agent account and immediately log in as it from `/login` (separate browser session/incognito).
- [x] 7.4 Manually verify: disabling a sales agent account blocks its subsequent login attempt.
- [x] 7.5 Manually verify: reload persists both session and role correctly for each role.

Verified via an automated Playwright smoke test against the running dev server (16/16 checks passed), covering all five scenarios above plus invalid-credential rejection. This run also caught and fixed a real bug: `authInterceptor` was force-logging-out any mock-session user the instant a real-backend screen 401'd — see design.md's Risks/Trade-offs for the fix.

## 8. Correction: admin gets full access, not a locked-down panel

The access model above (tasks 1–7) was over-built: it locked the admin out of the entire app except `/admin`. The actual requirement is that **both roles share the full app**; the only thing gated by role is the one extra "Sales Agents" screen, and sales agent creation belongs in a modal, not a separate route. Corrected as follows:

- [x] 8.1 Remove `salesAgentGuard`; the existing top-level route tree (dashboard, playground, monitor, knowledge-base, phone-numbers, agents) is gated only by the plain `authGuard`, shared by both roles.
- [x] 8.2 Simplify `guestGuard` back to always redirecting an authenticated user to `/monitor` (no role branch).
- [x] 8.3 Move `/admin` to be a normal child route inside the shared authenticated tree, gated only by `adminGuard`; delete the separate top-level `/admin` route tree and the `/admin/new` route.
- [x] 8.4 Revert `LoginComponent.submit()` to always navigate to `/monitor` (no role branch).
- [x] 8.5 Revert `NavShellComponent` to always render the full flyout shell for both roles; add one extra "Sales Agents" nav item, shown only when `role === 'admin'`.
- [x] 8.6 Fold sales-agent creation into a modal on `SalesAgentListComponent` (matching the existing "Create Knowledge Base" modal pattern); delete the separate `AddSalesAgentComponent` and its route.
- [x] 8.7 Update `proposal.md`, `design.md`, and the delta specs (`user-auth`, `nav-shell`, `sales-agent-accounts`) to describe the corrected model.
- [x] 8.8 Re-verify end-to-end with an updated Playwright smoke test (27/27 checks passed): both roles reach every existing screen; only `admin` reaches `/admin`; sales agents have no link to `/admin` anywhere in the shell; admin creates a sales agent via the modal and that account can immediately log in; disable still blocks login.

Also discovered during re-verification (environment issue, not an app bug): the local `ng serve` dev server's file watcher had gone stale mid-session and stopped picking up further edits, silently serving an old build. Restarting `ng serve` fixed it — noted in design.md's Risks/Trade-offs as a heads-up for local testing.

## 9. Add `name` field to sales agent accounts

- [x] 9.1 Add `name` to `SalesAgentAccount` and `CreateSalesAgentAccountInput` (`src/app/core/models/sales-agent-account.model.ts`).
- [x] 9.2 Thread `name` through the mock store (`mock-auth-store.ts`: `MockAccount`, seed accounts, `createSalesAgent()`, `toSalesAgentAccount()`) and `ApiService.createSalesAgent()`.
- [x] 9.3 Add a required Name field to the "Add Sales Agent Login" modal on `SalesAgentListComponent`, validated non-empty; add a Name column to the sales agent table (and its loading skeleton).
- [x] 9.4 Update `backend-openspec/specs/auth/spec.md`: `name` added to the request/response bodies of `POST /api/admin/sales-agents`, `GET /api/admin/sales-agents`, and the disable/enable endpoints.
- [x] 9.5 Update the `sales-agent-accounts` delta spec (Create/List requirements) to require a name.

## 10. Reset password & update name actions, with a cooler action bar

- [x] 10.1 Add `resetSalesAgentPassword(email, newPassword)` and `updateSalesAgentName(email, name)` to `mock-auth-store.ts`, `ApiService`, and `AdminService`, mirroring the existing mock latency/404 pattern.
- [x] 10.2 Add "Update Name" and "Reset Password" modals to `SalesAgentListComponent` (name: non-empty; password: 6+ chars with a matching confirmation field), each independent of the other fields on the account.
- [x] 10.3 Replace the single text Enable/Disable button with three icon-only actions per row (Update Name = pencil, Reset Password = key, Enable/Disable = user-check/user-slash), each with a `title` + `aria-label` tooltip; disable/enable's tooltip reflects the resulting action.
- [x] 10.4 Visual polish pass ("make the design more cool"): gradient-accented heading, a total-count badge next to the title, a circular initials avatar per row, a hover highlight on table rows, and colored hover states per action (warning for reset password, danger/success for disable/enable).
- [x] 10.5 Update `backend-openspec/specs/auth/spec.md` with `PATCH /api/admin/sales-agents/:email/name` and `POST /api/admin/sales-agents/:email/reset-password`.
- [x] 10.6 Update the `sales-agent-accounts` delta spec with "Update Sales Agent Name," "Reset Sales Agent Password," and "Per-Row Actions Use Icon Buttons With Tooltips" requirements.
- [x] 10.7 Verify end-to-end with Playwright (6/6 new checks, full 27/27 regression suite still green): tooltips present on the new icon buttons, avatar initials render and update on rename, name-update reflects in the list, and password reset invalidates the old password while the new one works.

## 11. Remove the mock login layer — wire the real backend (`logins.md`)

The backend team shipped the real API (auth + frontline-agents), documented at the repo root in `logins.md`. Remove every piece of the frontend mock and point directly at the real endpoints.

- [x] 11.1 Delete `src/app/core/http/mock-auth-store.ts` and `src/app/core/models/auth-storage.const.ts` entirely.
- [x] 11.2 Update `UserRole` to `'admin' | 'agent'` (was `'admin' | 'sales_agent'`) in `auth.model.ts`, matching the real backend's role string; add `name: string` to `AuthSession`.
- [x] 11.3 Add `name` and `role: UserRole` to `SessionResponse` in `api.types.ts` (real `GET /api/auth/session` returns full identity, not just email).
- [x] 11.4 Add `id: string` to `SalesAgentAccount`; add a `frontlineAgents` endpoint group to `api-config.ts` (`/frontline-agents`, `/frontline-agents/:id/{disable,enable,name,reset-password}`).
- [x] 11.5 Add `frontline-agent-mapper.ts` (`ApiFrontlineAgent` wire type + `fromApiFrontlineAgent()`) mapping the backend's `isDisabled`/full-user-object shape to the frontend's `SalesAgentAccount`.
- [x] 11.6 Rewrite `ApiService`'s auth section (`login`/`logout`/`getSession`) as plain HTTP passthroughs; rewrite the frontline-agents section to call the real endpoints (id-keyed, not email-keyed; `resetSalesAgentPassword` returns `Observable<void>` for the real `204`).
- [x] 11.7 Update `AdminService` method signatures to take `id` instead of `email`; update `SalesAgentListComponent`/template accordingly (`statusUpdatingId`, `track account.id`, password minimum 6 → 8 characters to match the real backend).
- [x] 11.8 Revert `authInterceptor` to unconditional 401 → logout (no more mock-token bypass) and `AuthService.validateSession()`/`auth.service.ts`'s storage-key constant to their pre-mock form; have `validateSession()` refresh identity from the real `/auth/session` response.
- [x] 11.9 Update `backend-openspec/specs/auth/spec.md` to point at `logins.md` as the authoritative contract instead of duplicating a now-stale proposed shape; update the `user-auth` and `sales-agent-accounts` delta specs (role literal `sales_agent` → `agent`, drop "mock" framing, password minimum 6 → 8, add a "Session Restore Refreshes Identity" requirement).
- [x] 11.10 Verify against the real locally-running backend: build clean, then Playwright against `http://localhost:2000/api` — login, session-restore-on-reload, logout (token revocation), and invalid-credential rejection all confirmed for an `agent`-role account (10/10 checks). **Could not verify** the `admin`-only Sales Agents screen end-to-end — no admin credential was available in this environment; flagged in design.md's Open Questions for whoever has one.
