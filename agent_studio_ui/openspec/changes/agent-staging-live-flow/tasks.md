## 1. Core Model

- [x] 1.1 In `src/app/core/models/agent.model.ts`, change `AgentStatus` to `'draft' | 'staged' | 'live' | 'disabled'`.
- [x] 1.2 Add `current_stage_version: number` to the `Agent` interface (defaults to `0` in `createEmptyAgent`), used to gate History panel availability without an extra request.
- [x] 1.3 Add an `AgentHistoryEntry` interface (or reuse `AgentVersion` — decide per design.md decision 4) shaped to hold: `id`, `agentId` (source `agent_id`), `stageVersion`, `snapshotStatus: 'staged' | 'live'`, `archivedAt`, `stagedAt`, `liveAt`, and a `snapshot: Agent`-shaped object built from the history row's fields.
- [x] 1.4 Update `src/app/core/utils/version-diff.util.ts` line ~20 (`versionChangeParts`) so the status-change summary reads `next.status === 'live' ? 'Went live' : ...` instead of `'active'`.

## 2. API Layer

- [x] 2.1 In `src/app/core/http/api-config.ts`, add to `ApiEndpoints.agents`: `stage: (id) => '/agents/${id}/stage'`, `live: (id) => '/agents/${id}/live'`, `disable: (id) => '/agents/${id}/disable'`, `enable: (id) => '/agents/${id}/enable'`, `history: (id) => '/agents/${id}/history'`, `historyByAgentId: (agentId) => '/agents/by-agent-id/${agentId}/history'`.
- [x] 2.2 In `src/app/core/http/api.types.ts`, update `ApiAgent['status']` and `UpdateAgentRequest['status']` to the new `AgentStatus` union (flows through automatically once the model type changes), and add `current_stage_version?: number` to `ApiAgent`. Add an `ApiAgentHistory` interface matching the backend's `AgentHistory` document (`id`, `source_agent_id`, `source_agent_document_id`, `stage_version`, `snapshot_status`, `agent_name`, `country_code`, `phone_number`, `enable_voice`, `nodes`, `base_template_id`, `greeting`, `behavior_prompt`, `behavior_notes`, `referral_bonus`, `knowledge_base_ids`, `mcp_servers`, `staged_at`, `live_at`, `archived_at`).
- [x] 2.3 In `src/app/core/http/agent-mapper.ts`: update `fromApiAgent` to map `current_stage_version` (default `0`) onto the frontend `Agent`. Add `fromApiAgentHistory(raw: ApiAgentHistory): AgentVersion` (or the type chosen in 1.3), reusing the existing `fromApiMcpServers` helper and building the `snapshot` via `createEmptyAgent()` + field overrides (see design.md decision 4's field-mapping table). Factor out any field-mapping logic shared with `fromApiAgent` (e.g. mcp servers, referral bonus) into small exported helpers instead of duplicating.
- [x] 2.4 In `src/app/core/http/api.service.ts`, add: `stageAgent(id)`, `liveAgent(id)`, `disableAgent(id)`, `enableAgent(id)` (all `POST` with `null` body, mapped through `fromApiAgent`), and `getAgentHistory(id)` (`GET .../history`, mapped through `fromApiAgentHistory` into a sorted list — already newest-first from the backend, no client re-sort needed beyond what the mapper produces).
- [x] 2.5 Remove the now-unused `activateAgent` helper in `api.service.ts` (its `PATCH .../status` approach is superseded by the dedicated lifecycle endpoints) — confirm no remaining call sites first.

## 3. AgentService Lifecycle Methods

- [x] 3.1 In `src/app/core/services/agent.service.ts`, replace `toggleStatus` with `disableAgent(id)` and `enableAgent(id)`, calling `api.disableAgent`/`api.enableAgent` directly (no more fetch-then-branch-then-PATCH — the backend endpoints already enforce the `live`⇄`disabled` precondition and return 409 otherwise, so let errors propagate to the caller instead of throwing a synthetic frontend error).
- [x] 3.2 Add `stageAgent(id)` calling `api.stageAgent(id)`.
- [x] 3.3 Rewrite `goLive(id)` to call `api.previewAgent(id)` (still required to (re)compute the hash) then `api.liveAgent(id)` — remove the old `updateAgent(id, { status: 'active' })` tail call.
- [x] 3.4 Add `getAgentHistory(id)` delegating to `api.getAgentHistory(id)`.
- [x] 3.5 Verify `previewAgent`/`callCustomer` are unchanged in shape (they already call the same `/preview` endpoint) — only their *preconditions* change (staged-only), which is enforced server-side and handled by the caller (task 5.x), not inside `AgentService`.

## 4. Agent History (Playground)

- [x] 4.1 Create `src/app/core/services/agent-history.service.ts`: a thin service wrapping `AgentService.getAgentHistory(id)`, returning the mapped list from task 2.3/2.4 (no local caching needed — Angular's `providedIn: 'root'` singleton plus a simple `Observable` per call is enough, matching `VersionHistoryService`'s external shape closely enough that the panel's usage barely changes).
- [x] 4.2 In `src/app/features/playground/agent-history-panel/agent-history-panel.component.ts`, replace the `VersionHistoryService` injection with `AgentHistoryService`; change the `ngOnInit` gate from `this.agentStatus !== 'active'` to using the agent's `current_stage_version` (add an `@Input({ required: true }) currentStageVersion!: number` alongside the existing `agentStatus` input, or drop `agentStatus` entirely if nothing else in the component needs it — check the template first).
- [x] 4.3 In `agent-history-panel.component.html`, change the empty-state condition from `agentStatus !== 'active'` to the new stage-version-based gate, and update its copy to "History is tracked once this agent is staged."
- [x] 4.4 In `playground-editor.component.ts`/`.html`, pass the new `currentStageVersion` input (`[currentStageVersion]="currentStageVersion()"`) to `<app-agent-history-panel>` — add a `currentStageVersion` signal alongside `status`, set from `agent.current_stage_version` in `loadExistingAgent` and reset to `0` in `loadFromParams`/`settleCreated` as appropriate.
- [x] 4.5 Remove the client-side version-creation calls in `playground-editor.component.ts`: `recordVersionIfChanged(result)` in `save()` and `versionHistoryService.saveVersion(updated, 'Went live')` in `goLive()`, plus the now-unused `recordVersionIfChanged` method and `VersionHistoryService`/`versionChangeParts` imports if nothing else in the file uses them (`onRestoreVersion` doesn't need them).

## 5. Playground Editor: Stage / Go Live / Preview Gating / Edit Warning

- [x] 5.1 Add a `stagingAgent` signal and a `moveToStaging()` method to `playground-editor.component.ts`: guarded on `status() === 'draft' && agentId()`, calls `agentService.stageAgent(id)`, sets `status`/`current_stage_version` from the response on success, toasts success/failure (extract backend message per design.md decision 8).
- [x] 5.2 Add a "Move to Staging" button in `playground-editor.component.html`'s header actions (next to the "History" button), visible when `agentId() && status() === 'draft'`.
- [x] 5.3 Update the header status badge markup (`[class.badge-active]="status() === 'active'"` etc.) to the four states: add a `badge-warning`/similar class for `staged`, keep `badge-active` for `live`, add a class for `disabled`, keep `badge-info` for `draft`.
- [x] 5.4 Update the "Go Live" button's guard in the template from `status() === 'draft' && previewPassed()` to `status() === 'staged' && previewPassed()`.
- [x] 5.5 Update `goLive()` in the component: guard on `status() === 'staged'` instead of `'draft'`; on the backend's stale-preview 409, clear `previewPassed`, keep `status` as `'staged'`, and toast the backend's specific error message instead of the generic "Failed to go live".
- [x] 5.6 Gate the Preview tab's content: wrap `<app-preview-panel>` so it only renders when `status() === 'staged'`; otherwise show a short message directing the user to "Move to Staging" first (satisfies the `agent-preview-call` spec's "Preview unavailable before staging" scenario).
- [x] 5.7 In `save()`, before calling `persist()` for an *existing* agent (`this.agentId()` truthy) whose `status()` is not `'draft'`, show a `confirmDialog.confirm(...)` warning ("Saving will move this agent back to Draft and archive its current version. Continue?"); only proceed with the existing save logic if confirmed. New (not-yet-created) agents skip this entirely, matching current behavior.
- [x] 5.8 Confirm `settleCreated`/`loadExistingAgent`/`loadFromParams` all correctly reset/set `current_stage_version` (see 4.4) alongside `status`.

## 6. Dashboard

- [x] 6.1 In `dashboard.component.ts`, rename the `counts` computed properties from `active`/`inactive` to `live`/`disabled` (add `staged` too), filtering on the new status values.
- [x] 6.2 Replace `toggleStatus(agent, event)` with logic that only offers a toggle for `live`⇄`disabled` agents: compute `target: 'live' | 'disabled'` from `agent.status === 'live' ? 'disabled' : 'live'`, call `agentService.disableAgent(id)` or `agentService.enableAgent(id)` accordingly (not a single generic `toggleStatus`), keep the existing optimistic-update/revert-on-error pattern.
- [x] 6.3 In `dashboard.component.html`: rename the `Active`/`Inactive` filter tabs to `Live`/`Disabled`, add a `Staged` tab; update `counts()` bindings to match (6.1); update the badge classes/text (`agent.status === 'live'` etc., 4 states now); change the toggle-vs-"Playground link" branch from `agent.status === 'draft'` to `agent.status === 'draft' || agent.status === 'staged'`; update the toggle's `[checked]`/label logic from `'active'`/`'Active'`/`'Inactive'` to `'live'`/`'Live'`/`'Disabled'`.

## 7. Monitor Agents

- [x] 7.1 In `monitor-list.component.ts`, change `agents.filter((a) => a.status === 'active')` to `a.status === 'live'` (rename the local `activeAgents` variable to `liveAgents` for clarity — compiler will not catch this rename but it's a 2-line diff, keep it tight).

## 8. Verification

- [x] 8.1 Run `ng build` (or the project's configured `tsc`/build script) and fix every compile error surfaced by the `AgentStatus` type change — this is the authoritative check that no stale `'active'`/`'inactive'` comparison was missed anywhere in the app (per design.md's risk mitigation).
- [x] 8.2 Grep the repo for any remaining `'active'` / `'inactive'` string literals compared against `.status` on an `Agent` (not a `KnowledgeBase` or `PhoneNumber`, which have their own unrelated status enums) and confirm none remain.
- [x] 8.3 Manually exercise the flow against a running backend if available: create a draft agent, Move to Staging, run a Call or Chat preview, Go Live, confirm the Dashboard/Monitor Agents lists reflect `live`, Disable it from the Dashboard, re-Enable it, then edit it and confirm it reverts to `draft` and the History panel shows the archived versions.
