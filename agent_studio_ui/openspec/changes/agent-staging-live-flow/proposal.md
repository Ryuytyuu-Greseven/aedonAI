## Why

The backend (`lyreai_agent_builder_server`, a separate repo) now implements a real draft → staged → live → disabled agent lifecycle: `POST /agents/:id/stage`, `POST /agents/:id/live` (preview-hash gated, clones the agent into a separate `live agents` collection), `POST /agents/:id/disable` / `POST /agents/:id/enable`, and `GET /agents/:id/history` / `GET /agents/by-agent-id/:agentId/history` for the archived version trail. The frontend still models agent status as the old two-and-a-half-state `'active' | 'inactive' | 'draft'` vocabulary, drives "Go Live" through a `PATCH .../status`, and renders version history entirely from local mock data. The frontend needs to catch up to the real contract so staging, going live, disabling, and history browsing actually work against the backend.

## What Changes

- **BREAKING**: `AgentStatus` changes from `'active' | 'inactive' | 'draft'` to `'draft' | 'staged' | 'live' | 'disabled'` everywhere in the frontend (model, mapper, service, and every component that reads/displays/filters on agent status).
- Add API client support for the four new lifecycle actions (`stage`, `live`, `disable`, `enable`) and the two history endpoints, replacing the current `PATCH`-with-`status` approach to activation/deactivation.
- `AgentService` gains `stageAgent`, `goLive` (rewritten to call the real `live` endpoint after a preview check, surfacing the backend's 409 "stale preview" and "wrong current status" errors instead of silently patching status), `disableAgent`, `enableAgent`, and `getAgentHistory`.
- Editing (`PATCH`) a `staged`, `live`, or `disabled` agent reverts it to `draft` server-side (archiving the previous version); the frontend must reflect the returned status after every update rather than assuming the edited fields alone changed, and should warn the user before an edit that will revert a staged/live agent to draft.
- The agent history panel (Playground) switches from the local mock `VersionHistoryService` to the real `GET /agents/by-agent-id/:agentId/history` endpoint, and is available whenever the agent has stage history (`current_stage_version > 0`) rather than gated on `status === 'active'`.
- Every UI surface that branches on the old status values (dashboard cards, monitor-agents list/filtering, playground editor header/actions, knowledge-base usage warnings) is updated to the new 4-state vocabulary, including a new "Staged" state that previously didn't exist in the UI at all.
- Out of scope: no live-agents list/detail screen (the backend exposes no read endpoint for the `live agents` collection — it's an internal clone target only), and no changes to any server-side code/collections (all backend work is already done in the other repo).

## Capabilities

### New Capabilities
- `agent-lifecycle`: draft/staged/live/disabled status model, the stage/go-live/disable/enable transitions (including preview-hash gating and edit-reverts-to-draft semantics), and history-by-agent-id retrieval.

### Modified Capabilities
- `playground`: "Draft and Live states" becomes draft → staged → live (→ disabled), with staging as a distinct, explicit step before go-live rather than an implicit one.
- `version-history`: version data source changes from static mock data to the real backend `agent_histories` records, and its availability gate changes from `status === 'active'` to "agent has at least one archived stage version."
- `monitor-agents`: "Only `active` (Live) agents are monitored" becomes "only `live` agents are monitored"; status vocabulary throughout the spec updates from `active`/`draft`/`inactive` to `draft`/`staged`/`live`/`disabled`.
- `dashboard`: agent status display changes from "Active / Inactive / Draft" to "Draft / Staged / Live / Disabled".
- `agent-preview-call`: the "Go Live" gate this capability feeds into now requires the agent to be `staged` (not just previewed-in-session), matching the backend's preview-hash-on-staged-agent requirement.

## Impact

- `src/app/core/models/agent.model.ts` — `AgentStatus` type and any status-derived helpers/labels.
- `src/app/core/http/api.types.ts`, `api-config.ts`, `api.service.ts`, `agent-mapper.ts` — new endpoints (`stage`, `live`, `disable`, `enable`, `history`, `historyByAgentId`) and request/response shapes (`AgentHistory`).
- `src/app/core/services/agent.service.ts` — lifecycle methods replacing `toggleStatus`/`goLive`.
- `src/app/features/playground/agent-history-panel/agent-history-panel.component.ts` (+ template) and `src/app/core/services/version-history.service.ts` (or a new `agent-history.service.ts`) — real backend-backed history.
- `src/app/features/dashboard/dashboard.component.ts`, `src/app/features/monitor-agents/monitor-list/monitor-list.component.ts`, `src/app/features/playground/playground-editor/playground-editor.component.ts`, `src/app/features/playground/agent-knowledge-bases/agent-knowledge-bases.component.ts`, `src/app/core/utils/version-diff.util.ts` — status-vocabulary updates.
- No changes outside `builder_config`; no changes to server/collection logic anywhere.
