## Context

The backend (`lyreai_agent_builder_server`, separate repo, already implemented) models an agent's lifecycle as `draft → staged → live` with a side branch `live ⇄ disabled`, backed by three Mongo collections (`agents`, `live agents`, `agent_histories`) and these endpoints on `/agents`:

- `POST /:id/stage` — `draft` → `staged` only; increments `current_stage_version`; clears `preview_hash`.
- `POST /:id/preview` — `staged` only (409 otherwise); computes and stores `preview_hash` from `{greeting, behavior_prompt, behavior_notes}`.
- `POST /:id/live` — `staged` only; 409 if the current field hash doesn't match the stored `preview_hash` (stale preview); archives the current stage version into `agent_histories`, upserts the `live agents` collection, sets status `live`.
- `POST /:id/disable` — `live` → `disabled`. `POST /:id/enable` — `disabled` → `live`.
- `PATCH /:id` — editing a `staged`/`live`/`disabled` agent archives its current snapshot into `agent_histories` and silently resets it to `draft` (clearing `preview_hash`/`staged_at`/`live_at`); editing a `draft` agent is a normal in-place update.
- `GET /:id/history` and `GET /by-agent-id/:agentId/history` — both return the same `AgentHistory[]`, newest `stage_version` first.

The frontend (`builder_config`, this repo) currently models status as `'active' | 'inactive' | 'draft'`, drives "Go Live" through a single `PATCH .../status`, and renders the Playground's agent-level History panel entirely from a local mock `VersionHistoryService`. None of this matches the real contract above. This design covers bringing the frontend in line, frontend-only — the backend is out of scope and untouched.

## Goals / Non-Goals

**Goals:**
- Replace the fake `active`/`inactive` status vocabulary with the real `draft`/`staged`/`live`/`disabled` one, everywhere it's read or written in the frontend.
- Wire the Playground editor to the real stage → preview → live pipeline, including the 409 failure modes (wrong current status, stale preview).
- Make the Playground's agent-level History panel read real `agent_histories` records instead of mock data, while preserving its existing detail/diff/restore UX.
- Make the Dashboard's status quick-toggle drive the real `disable`/`enable` endpoints instead of a fake PATCH.
- Keep the blast radius to `builder_config`'s `src/app` — no server changes, no new backend endpoints assumed beyond what already exists.

**Non-Goals:**
- No live-agents list/detail screen — the backend exposes no `GET` for the `live agents` collection, it's an internal clone target only.
- No change to Agent Builder's (non-Playground) node-level or prompt-level version history — those stay mock-data-backed per the existing `version-history` capability; only the Playground's *agent-level* history moves to the backend.
- No change to how Tools/MCP servers/knowledge-base linking invalidate the in-session preview flag (`previewPassed`) — that mechanism is reused, not redesigned.
- No optimistic UI for stage/live/disable/enable transitions — these are explicit, confirmed, low-frequency actions; a simple pending-state + refresh-on-success/error is enough (matches existing `goingLive` signal pattern).

## Decisions

### 1. Status rename is a straight breaking change, no compatibility shim
`AgentStatus` becomes `'draft' | 'staged' | 'live' | 'disabled'`. There is no dual-reading of old and new values: the backend never emits `'active'`/`'inactive'` today, so a shim would only paper over call sites we haven't actually updated. Every read site is updated in this change (see Impact in proposal.md).

### 2. "Go Live" becomes two explicit steps: Stage, then Go Live
Today the Playground has one action: `draft` --Go Live--> `active`, gated on an in-session preview. The backend now requires `draft` --stage--> `staged` --preview + live--> `live`. The editor toolbar gets a **"Move to Staging"** action (visible when `status === 'draft'`) alongside the existing **"Go Live"** action (visible when `status === 'staged'`).

- Staging has no confirmation modal — it's reversible (editing reverts to draft) and low-consequence.
- Preview (Call/Chat sub-tabs) becomes reachable only when `status === 'staged'`, not `'draft'` as today — this matches the backend's `POST /:id/preview` 409ing on anything but `staged`. `previewPassed` continues to gate "Go Live", and continues to be invalidated by field/tool/MCP/KB changes exactly as today (those changes go through `PATCH`, which server-side reverts a `staged` agent to `draft` anyway — see decision 4 — so invalidating the local flag is consistent with the server truth).
- "Go Live" keeps its existing confirmation modal, message updated to mention the agent becomes available to take calls (unchanged in substance).

Alternative considered: collapse stage+preview+live into one client-side-orchestrated "Go Live" button that calls `stage` → `preview` → `live` in sequence. Rejected: it hides the "staged" state the user is meant to explicitly test in, and the backend's whole point of a separate `staged` status is to give the user a window to run Preview against a pinned, staged configuration before committing. A single button would also make the intermediate `staged` state invisible in the UI, contradicting the user's stated requirement ("user will test this staging agent").

### 3. Editing a non-draft agent needs a pre-save warning, not a post-save surprise
Since `PATCH` on a `staged`/`live`/`disabled` agent silently reverts it to `draft` and archives the previous version server-side, `save()` in `playground-editor.component.ts` gets a guard: if `status()` is not `'draft'` when Save is clicked, show a confirmation dialog ("Saving will move this agent back to Draft and archive its current staged/live version. Continue?") before persisting. On success, the component already does `this.status.set(result.status)` — this naturally picks up the server's `'draft'` reset with no additional code.

### 4. Playground-level history moves to a new `AgentHistoryService`, not a modified `VersionHistoryService`
`VersionHistoryService` stays exactly as-is and keeps serving Agent Builder's node-level/prompt-level mock history (out of scope here). A new `AgentHistoryService` (`core/services/agent-history.service.ts`) wraps `ApiService.getAgentHistory(id)` and maps the backend's `AgentHistory[]` into the existing `AgentVersion[]` shape the panel/template/diff-util already consume:

| `AgentHistory` field | `AgentVersion` field | Notes |
|---|---|---|
| `stage_version` | `versionNumber` | |
| `archived_at` | `timestamp` | |
| `snapshot_status` | used to build `label` (`"Staged"` / `"Went live"`) | |
| everything else (`agent_name`, `greeting`, `behavior_prompt`→`prompt`, `behavior_notes`→`behavior`, `mcp_servers`, `knowledge_base_ids`, `referral_bonus`, `country_code`, `phone_number`, `enable_voice`, `nodes`) | `snapshot: Agent` (partial, reconstructed via `createEmptyAgent` + overrides; `id`/`created_at`/`updated_at` are synthesized since a history row isn't a live agent) | Reuses `fromApiAgent`-style field mapping so `versionChangeParts`/`diffAgentJson` keep working unmodified |

`agent-history-panel.component.ts` swaps its `VersionHistoryService` injection for `AgentHistoryService` and drops the `agentStatus !== 'active'` gate (see decision 5). `summary` is derived the same way version-history already does today (`versionChangeParts` against the previous entry in the list) — no backend summary field exists, so this stays a client-side computation, just fed by real snapshots instead of mock ones.

Alternative considered: extend `VersionHistoryService` itself with a real/mock branch. Rejected — it already has a distinct, still-valid mock-data responsibility for Agent Builder; overloading it with a live HTTP path for one caller (Playground) makes it harder to reason about which callers hit the network.

### 5. History panel availability gates on `current_stage_version > 0`, not on status
`current_stage_version` is added to the `Agent` model (mapped from the API's existing `current_stage_version` field, defaulting to `0`) so the History panel can synchronously decide whether to show the empty state ("History is tracked once this agent is staged") without an extra round-trip. This replaces the old `status === 'draft'` / `agentStatus !== 'active'` gates, since history now exists for any agent that has been staged at least once — including ones currently sitting back in `draft` after an edit-revert.

### 6. Server-side version creation replaces client-side `saveVersion` calls for Playground
Today `playground-editor.component.ts` calls `versionHistoryService.saveVersion(...)` after "Go Live" and after any save of an already-`active` agent (`recordVersionIfChanged`). This entire mechanism is now redundant and wrong: the backend creates history rows itself, as a side effect of `stage`/`live`/edit-revert. Both call sites are removed from `playground-editor.component.ts`; the History panel simply reflects whatever the backend has recorded when opened.

### 7. Disable/Enable wire into the existing Dashboard quick-toggle, not a new Playground control
The user's requirement doesn't ask for a disable/enable control inside the Playground editor itself, and the Dashboard already has an "Agent Status Toggle (Quick Action)" spec'd for `active`⇄`inactive`. That toggle is retargeted at `disableAgent`/`enableAgent`, shown only for `live`/`disabled` agents (unchanged shape, just new verbs and a `staged` agent now also has no toggle, same as `draft` today).

### 8. Error surfacing for lifecycle 409s
`AgentService`'s new `stageAgent`/`goLive`/`disableAgent`/`enableAgent` let `HttpErrorResponse` propagate; calling components catch it and toast the backend's `error.error.message` when present (Nest's default error body shape), falling back to a generic per-action message (e.g. "Failed to go live") otherwise. A small `extractErrorMessage(err, fallback)` helper is added alongside the existing toast usage rather than a global HTTP interceptor, since these are the first call sites in the app that need to surface a specific backend validation message instead of a generic failure toast.

## Risks / Trade-offs

- **[Risk]** Every component that branches on `AgentStatus` must be updated in the same change, or the app fails to compile / behaves inconsistently (e.g. a dashboard still filtering on `'active'`). → Mitigation: `AgentStatus` is a TypeScript union; renaming it makes every stale comparison a compile error, so `tsc`/`ng build` catches all call sites — tasks.md enumerates them from a repo-wide grep as a checklist, but the compiler is the actual safety net.
- **[Risk]** Reconstructing an `Agent`-shaped snapshot from an `AgentHistory` row (decision 4) could silently diverge from `fromApiAgent`'s real mapping if either drifts independently. → Mitigation: factor the shared field-mapping logic (mcp servers, referral bonus, etc.) out of `agent-mapper.ts` into small exported functions reused by both `fromApiAgent` and the new history-to-`AgentVersion` mapper, instead of duplicating field lists.
- **[Risk]** Users mid-way through the old single-step "Go Live" mental model may be confused by the new "Move to Staging" step appearing. → Mitigation: this is a direct instruction from the user (explicit draft→stage→live flow requested); no UX mitigation beyond clear button labels is in scope.
- **[Trade-off]** No live-agents screen means a user can't directly browse the `live agents` collection's contents from the UI — only via the source agent's `status: 'live'` in the normal Dashboard list. Accepted per explicit scope note in the proposal (no backend read endpoint exists for it).

## Migration Plan

Pure frontend change, deployed as a normal build/release of `builder_config`; no data migration. Because the backend has already shipped the new endpoints and no longer accepts the old implicit `PATCH .../status` "activate" semantics in the way the old frontend assumed (`status` is deliberately stripped from `PATCH` bodies server-side today), this frontend change should ship promptly — until it does, the existing "Go Live"/toggle UI will silently no-op on status changes (the `PATCH` will succeed but the returned `status` will just stay whatever it already was, since the server no longer honors a `status` field in the patch). No rollback concerns beyond a normal revert, since the backend contract doesn't change.

## Open Questions

- None blocking. The one open item — whether Disable/Enable should also get direct controls inside the Playground editor toolbar (vs. Dashboard-only, decision 7) — is left for a follow-up change if the user asks for it; not required by the stated ask.
