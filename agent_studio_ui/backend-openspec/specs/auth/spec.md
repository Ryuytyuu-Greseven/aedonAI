# Auth API

## Purpose

Email/password login, session, and frontline-agent (admin-managed sales agent) management. Backs `src/app/core/services/auth.service.ts` and `src/app/core/services/admin.service.ts`, gated via `src/app/core/guards/auth.guard.ts`.

**This is now a real, implemented backend — no frontend mock remains.** The authoritative API reference is [`/logins.md`](../../../logins.md) at the repo root; this file intentionally does not duplicate it to avoid the two drifting out of sync. Key points for anyone reading only this doc:

- Two roles: `admin` and `agent` (the frontend's internal `UserRole` type). `agent` is everything today's app already does; `admin` gets that plus `/admin`, the frontline-agents (sales agent account) management screen.
- `role` is resolved fresh from the database on every authenticated request — disabling/renaming/re-roling a user takes effect on their very next request, not just their next login.
- Frontend mapping: `src/app/core/http/frontline-agent-mapper.ts` translates the wire shape (`isDisabled`, full user object) to the frontend's slimmer `SalesAgentAccount` (`enabled`, only the fields the UI needs).
- Frontline-agent actions (enable/disable/rename/reset-password) are keyed by the account's `id`, not its email — see `ApiEndpoints.frontlineAgents` in `src/app/core/http/api-config.ts`.

See `logins.md` for full request/response shapes, validation rules, and the quick-reference endpoint table.

## Open decisions

- **Multi-company scoping.** `companyId` exists on every user but is always `null` today (per `logins.md`) — company-scoped admin management isn't wired up yet server-side beyond a no-op check.
- **Frontline agent deletion.** Only enable/disable is implemented (matches the frontend). Hard delete is unspecified.
