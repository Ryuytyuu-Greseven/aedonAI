# Backend OpenSpec

This folder is a backend implementation reference for AedonAI Builder. The frontend (`../src`) is fully built against **mock services** — every "API call" today is an in-memory `Observable` with a simulated network delay (`of(...).pipe(delay(300))`). Nothing here is aspirational: every endpoint below is derived directly from a mock method that already exists, is already wired into a real screen, and has already been exercised end-to-end in a browser. Implementing these contracts and swapping the mocks for real `HttpClient` calls should require **no frontend contract changes** — only the internals of the Angular services in `src/app/core/services/*.service.ts` change (delete the in-memory array + `delay()`, add an `HttpClient` call).

## Why a separate folder from `../openspec`

`../openspec/` is the frontend's spec-driven planning home, managed by the `openspec` CLI (`openspec status`, `openspec new change`, etc.). This folder is **not** CLI-managed — it's a plain set of markdown files written by hand, so it doesn't collide with the frontend's single active planning home. Each spec here reads like a REST API contract (method, path, request/response JSON, status codes) rather than the abstract WHEN/THEN scenarios in `../openspec/specs/*/spec.md`, because a backend engineer implementing against this needs concrete shapes, not behavioral prose. Where useful, a couple of WHEN/THEN scenarios are kept for consistency with the rest of the repo's conventions, but they're not the main content.

## Mapping to frontend capabilities

| This folder | Frontend `openspec` capabilities it backs | Frontend service(s) |
|---|---|---|
| `specs/auth/spec.md` | (auth was implemented before `openspec` capability tracking started here — see `src/app/core/services/auth.service.ts`) | `AuthService` |
| `specs/agents/spec.md` | `playground`, `agent-clone`, `agent-preview-call`, `export-destinations`, `referral-bonus-config`, `dashboard` (agent list/status/delete) | `AgentService` |
| `specs/templates/spec.md` | `static-agent-catalog` | `AgentTemplateService` |
| `specs/monitoring/spec.md` | `monitor-agents` | `CallRecordService` |
| `specs/reporting/spec.md` | `reporting` (currently sitting as an un-synced change at `../openspec/changes/reporting/` — it was implemented and verified but never archived into `../openspec/specs/`; worth doing that frontend-side cleanup separately) | `ReportService` |

Deliberately **not** covered here: `ThemeService`, `ToastService`, `ConfirmDialogService`, `VersionHistoryService` — pure client-side UI state with no backend involvement.

## How to use this as a backend engineer

1. Pick a spec file, implement its endpoints against whatever stack/DB you're using.
2. Point the matching frontend service's methods at your real API (base URL + `HttpClient.get/post/patch/delete` in place of `of(...).pipe(delay(...))`). The method names, parameter shapes, and return shapes in each spec match the current Angular service method signatures 1:1 — that mapping is called out at the top of each endpoint.
3. Each spec's "Business rules the backend must enforce" section lists logic the mock currently fakes client-side (name-collision handling on clone, fallback-to-template-default, etc.) that a real backend needs to own, since a real client can no longer be trusted to enforce them consistently (e.g., two browser tabs).
4. Each spec's "Open decisions" section flags things that were never actually decided — not just "unimplemented," but genuinely undecided by the product owner. Don't guess on these; they're flagged precisely because guessing would be wrong here as often as right.

## Data model quick reference

The full current TypeScript models are in `src/app/core/models/*.model.ts` — read those directly for the authoritative shape (this file won't be kept in sync if they change). As of this writing:

- `Agent` — the core resource. Has `nodes`/`tools` fields inherited from an earlier free-form "Agent Builder" mode that's dormant but not deleted (see `specs/agents/spec.md` for what that means for you).
- `AgentTemplate` — the 5 fixed static templates.
- `Tool` — generic; when `kind !== 'custom'` it's actually an export destination, not a real LLM tool (see `specs/agents/spec.md`).
- `CallRecord` / `AgentCallStats` — call/lead metadata for monitoring.
- `GeneratedReport` / `ReportRequest` — reporting.
- `AuthSession` / `LoginCredentials` — auth.
