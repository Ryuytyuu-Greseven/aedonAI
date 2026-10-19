## Why

Live agents keep changing after they go live — prompt, behavior, connected MCP servers, and integration/export destinations can all be edited over time. Customers have no way today to see what changed and when for a given agent. The Playground already has generic version-tracking infrastructure (`VersionHistoryService`, `AgentVersion` model) built for the unreachable Agent Builder route, but nothing surfaces it in the Playground, and its triggering rule (save = new version, unconditionally) doesn't match what's needed here.

## What Changes

- Add a toggleable **History side panel** to the Playground editor, reachable from the header regardless of which tab (Build, Integrations, MCP Servers, Preview) is active.
- The panel lists version entries for the current agent: version number, timestamp, and a change summary.
- History is only tracked for **Live (`active`) agents** — draft agents never accumulate history. The first entry is created when the agent goes live; every subsequent save while the agent is already `active` creates a new entry if anything changed.
- Clicking a version entry opens a **modal** showing that version's summary plus a field-level diff against the previous version.
- The modal includes a **"Restore this version"** action: it loads that version's snapshot (greeting, prompt, behavior, referral bonus, tools/integrations, MCP servers) back into the editor's in-memory state without auto-saving — the user must explicitly click Save to keep it, consistent with the existing Restore Agent Version requirement.
- Extend `computeVersionSummary` to describe Playground-relevant changes (prompt/behavior/greeting edits, MCP server or integration additions/removals) in addition to the existing agent-name/node/tool coverage — Playground agents have no nodes, so today's summary text would otherwise always read "Minor updates".
- No new backend/API: versions continue to be produced and read via the existing mock `VersionHistoryService`.

## Capabilities

### New Capabilities
(none — reuses the existing `version-history` capability)

### Modified Capabilities
- `version-history`: Extends version tracking to the Playground editor (side panel + modal instead of a dedicated tab), restricts version creation to Live agents (go-live transition and subsequent saves while Live), and extends change-summary generation to cover Playground-specific fields.
- `playground`: The Playground editor gains a History side panel, toggleable from any tab, for reviewing and restoring past versions of a Live agent.

## Impact

- Affected frontend: `playground-editor.component.ts`/`.html` (history panel toggle, wiring `saveVersion` calls into `save()`/`goLive()`), a new history panel + detail modal component under `src/app/features/playground/`, `version-diff.util.ts` (`computeVersionSummary` extended), `version-history.service.ts` (unchanged API surface, called with the new gating logic from the caller side).
- No changes to Agent Builder or its existing version-history tab/component — this change only affects how Playground calls the shared service, not the service's behavior for other callers.
- No backend/API changes; all persistence remains mocked.
