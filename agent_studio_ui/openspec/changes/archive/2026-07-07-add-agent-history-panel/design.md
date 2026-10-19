## Context

`VersionHistoryService`, `AgentVersion`, `PromptHistoryEntry`, and the diff utilities in `version-diff.util.ts` already exist in `src/app/core/` — they are generic over `Agent`, not tied to Agent Builder, and are already seeded per-agent-id in `src/mocks/version-history.mock.ts` (including the Playground mock agents). Today the only consumer is `VersionHistoryComponent` inside the unreachable Agent Builder route (`src/app/features/agent-builder/version-history/`), which renders a "Version History" tab with an inline detail `<aside>` and unconditionally saves a version on every builder save/auto-save.

Per `playground/spec.md`, Playground is the sole real agent creation/editing surface, and per this session's earlier work the editor already has a header + tab strip (Build / Integrations / MCP Servers / Preview). Playground agents have no `nodes` (flow graph), so per-node/prompt-level history (two of the five existing `version-history` requirements) does not apply here — only the agent-level list/detail/restore requirements are relevant.

`computeVersionSummary(prev, next)` currently only describes `agent_name`, `enable_voice`, node adds/removes/prompt-renames, and tool additions — all node-shaped or otherwise not covering Playground's actual editable surface (`greeting`, `prompt`, `behavior`, `mcp_servers`, tool removals). Every Playground save would summarize as "Minor updates" without extending it.

## Goals / Non-Goals

**Goals:**
- Add a History side panel to the Playground editor, toggle-accessible from any tab.
- Only create version entries for agents that are (or are becoming) `active` — never for `draft`.
- Create the first entry at the moment an agent goes live; create a new entry on every subsequent save while already `active`, if the agent actually changed.
- Let the user open a version's detail in a modal (summary + diff) and restore it into in-memory editor state.
- Make change summaries meaningful for Playground's actual fields.

**Non-Goals:**
- No changes to Agent Builder's own "Version History" tab, component, or its unconditional save-triggers — those keep working exactly as they do today, since that route is out of scope per prior decisions.
- No per-node or prompt-level history in Playground — Playground has no nodes.
- No backend changes — versions remain mock, in-memory, keyed by `agentId`, reset on full page reload (same limitation as the rest of the mock services).
- No change to how/when `draft` agents are saved — only whether a version entry is recorded.

## Decisions

**Where the gating logic lives**: `VersionHistoryService.saveVersion()` itself stays unconditional (it just records whatever `Agent` it's given) — the "only for Live agents" rule is enforced by *the caller*. `PlaygroundEditorComponent` calls `versionHistoryService.saveVersion(...)` in exactly two places: (1) inside `goLive()`'s success handler, always (this is the transition into `active`), and (2) inside `save()`'s success handler, only when `result.status === 'active'`. This keeps the shared service/model untouched — safer than adding an `if (agent.status !== 'active') return` inside the service, which would silently change behavior for the existing Agent Builder caller too.

**Skip no-op saves**: Before calling `saveVersion` on an active-agent save, compare the new payload against the latest known snapshot (`agentsEqual`-style check, or simply let `computeVersionSummary` run and skip persisting if it would just say "No changes") — a version entry is only worth creating if something actually changed. Concretely: fetch the latest version's snapshot first (already exposed via `getVersions`), diff, and only call `saveVersion` if the diff is non-empty. This avoids a wall of identical "Minor updates" entries for repeated saves with no edits.

**Component shape — side panel, not a tab**: A new `AgentHistoryPanelComponent` renders as a slide-over/drawer, toggled by a "History" button in the editor header (alongside Reset/Clone), independent of `activeTab`. This matches the explicit ask ("side panel", available regardless of tab) and differs from Agent Builder's tab-based `VersionHistoryComponent`. Inputs: `[agentId]`; internally it calls `VersionHistoryService.getVersions(agentId)` itself (mirrors how the existing component already self-loads via `ngOnInit`).

**Detail view — modal, not inline aside**: Clicking a version entry opens a modal (reusing the app's existing modal/dialog convention, same as the MCP Servers delete-confirmation modal) showing version number, timestamp, the `computeVersionSummary` line, and `diffAgentJson(prev, version.snapshot)` output. A "Restore this version" button sits in the modal footer.

**Restore semantics for Playground**: Restoring applies the snapshot's `greeting`, `prompt`, `behavior`, `referral_bonus`, `tools`, and `mcp_servers` onto the editor's current form/signals (`form.patchValue(...)`, `tools.set(...)`, `mcpServers.set(...)`) — not `nodes` (Playground doesn't use them). This does not call `save()` — per the existing Restore Agent Version requirement, the user must explicitly click Save afterward. A toast confirms: `Restored to version #<N>. Save to keep these changes.` Closes the modal and the history panel after restoring so the user lands back on the form to review/save.

**Extending `computeVersionSummary`**: Add checks (only meaningful when the respective field differs) for: `prompt` changed → `Modified prompt`; `behavior` changed → `Modified behavior`; `greeting` changed → `Modified greeting`; `mcp_servers` added/removed by id → `Added MCP server "<name>"` / `Removed MCP server "<name>"`; extend the existing tool-add check with a matching tool-remove check → `Added integration "<name>"` / `Removed integration "<name>"` (tools already covers Export Destinations entries). These are additive checks alongside the existing node/agent_name/enable_voice ones, so Agent Builder's summaries are unaffected (its agents don't set `prompt`/`behavior`/`greeting`/`mcp_servers` in a way that changes across its own saves).

**Where the History button/panel sits relative to tabs**: rendered once in the outer `@else` block of `playground-editor.component.html`, alongside the header, so it's visible/openable no matter which of the four tabs is selected — panel open/closed is tracked by its own signal (`historyPanelOpen`), independent of `activeTab`.

## Risks / Trade-offs

- [Comparing "latest known snapshot" to decide whether to skip a no-op version requires an extra `getVersions` read before every active-agent save] → Acceptable: mock call with a 200ms artificial delay, not a real network round trip; only triggered for already-`active` agents (not every keystroke).
- [Restoring only covers greeting/prompt/behavior/referral_bonus/tools/mcp_servers, not `nodes`] → Correct for Playground, since Playground never edits `nodes`; documented explicitly so it isn't mistaken for a bug later if this code is ever shared with Agent Builder.
- [Two different UI shells now exist for the same underlying `AgentVersion` data — tab+aside in Agent Builder, panel+modal in Playground] → Acceptable near-term duplication; Agent Builder is unreachable/frozen, so no shared-component refactor is justified right now.
- [In-memory mock store resets on full page reload, so restored-but-unsaved state and freshly created versions are both only durable within a single SPA session] → Same pre-existing limitation as every other mock service in this app; not new to this change.

## Open Questions

- None blocking. Whether Agent Builder's version-history should eventually be consolidated onto the same panel/modal shell is a future cleanup, not needed for this change.
