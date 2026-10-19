## Why

Today the app has a single implicit user and a single login that lands everyone in the same set of screens. The company now has two kinds of humans logging in through that one form: sales agents who build/monitor voice agents (today's full app), and a company admin who does everything a sales agent does PLUS provisions logins for sales agents. There is no way to tell them apart or to give the admin a dedicated management surface, so we need role-based access on top of the existing login.

## What Changes

- Add a `role` (`'admin' | 'sales_agent'`) to the authenticated session, returned by login.
- **BREAKING (mocked, frontend-only for now)**: since the real backend does not yet return `role` or support sales-agent account management, login and the new admin endpoints are served by a frontend mock layer (same pattern already used for other not-yet-built backend contracts in this repo). The real contract is documented in `backend-openspec/specs/auth/spec.md` for the backend team to implement later.
- Both roles share the entire existing app (dashboard, playground, monitor, knowledge base, phone numbers, agent builder) unchanged. The only thing gated by role is a single additional screen:
  - `admin` additionally gets a "Sales Agents" destination (`/admin`) for creating and listing sales agent login accounts (with the ability to disable/re-enable a login).
  - `sales_agent` cannot reach `/admin` — it isn't shown in navigation and is redirected away on direct URL access.
- Adding a sales agent login happens via a modal on the "Sales Agents" screen itself, not a separate page/route.
- Nav Shell is identical for both roles except admins see one extra nav entry ("Sales Agents") linking to `/admin`.
- Route guards: `/admin` is gated by an admin-only guard; every other route uses the existing plain authenticated guard (unchanged, applies to both roles).

## Capabilities

### New Capabilities
- `sales-agent-accounts`: Admin-only screen (and mocked API) for creating and listing sales agent login accounts, embedded as a modal within the Sales Agents list screen.

### Modified Capabilities
- `user-auth`: Session gains a `role`. Route protection adds one admin-only route (`/admin`); every other route remains gated only by "is authenticated", shared by both roles.
- `nav-shell`: Navigation chrome is the same right-edge flyout for both roles; admins see one additional nav entry ("Sales Agents") that sales agents don't see.

## Impact

- Frontend: `src/app/core/models/auth.model.ts`, `src/app/core/services/auth.service.ts`, `src/app/core/guards/auth.guard.ts`, `src/app/app.routes.ts`, `src/app/shared/nav-shell/*`, `src/app/core/http/api.service.ts` (+ new mock layer), `src/app/core/interceptors/auth.interceptor.ts`, new `src/app/features/admin-panel/sales-agent-list/*` screen.
- Docs: `backend-openspec/specs/auth/spec.md` gains the `role` field and two new endpoints for the backend team; `openspec/specs/user-auth/spec.md` and `openspec/specs/nav-shell/spec.md` get delta specs; new `openspec/specs/sales-agent-accounts/spec.md`.
- No changes to existing screens' internal behavior for either role — the only new gated surface is the `/admin` screen itself.
