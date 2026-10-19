## 1. Change Summary Utility

- [x] 1.1 Extend `computeVersionSummary()` in `src/app/core/utils/version-diff.util.ts` to detect and describe: `prompt` changed, `behavior` changed, `greeting` changed
- [x] 1.2 Extend `computeVersionSummary()` to detect `mcp_servers` additions/removals by `id`, describing them as `Added MCP server "<name>"` / `Removed MCP server "<name>"`
- [x] 1.3 Extend the existing tool-addition check with a matching tool-removal check, describing additions/removals as `Added integration "<name>"` / `Removed integration "<name>"`
- [x] 1.4 Verify existing Agent Builder summaries (agent_name/enable_voice/node/tool-add cases) are unaffected by the additions

## 2. Playground Editor: Version Creation Trigger

- [x] 2.1 In `playground-editor.component.ts`, inject `VersionHistoryService`
- [x] 2.2 In `goLive()`'s success handler, call `versionHistoryService.saveVersion(updated, 'Went live')` after the status transitions to `active`
- [x] 2.3 In `save()`'s success handler, when `result.status === 'active'`, fetch the latest recorded version's snapshot (via `getVersions`), diff it against `result`, and call `saveVersion(result, 'Manual save')` only if something actually changed
- [x] 2.4 Do not call `saveVersion` at all when the saved/updated agent's status is `draft`

## 3. Agent History Panel Component (Playground)

- [x] 3.1 Scaffold `src/app/features/playground/agent-history-panel/agent-history-panel.component.ts` (+ `.html`, `.css`) with `[agentId]: string` and `[agentStatus]: AgentStatus` inputs and an `(restore): AgentVersion` output
- [x] 3.2 Implement the side-panel/drawer shell: header ("History"), close button, list body
- [x] 3.3 On open, if `agentStatus !== 'active'`, show the empty state: "No history yet. History is tracked once this agent goes live."
- [x] 3.4 On open for an `active` agent, load versions via `VersionHistoryService.getVersions(agentId)` and render each entry: version number, formatted timestamp, summary text, newest first
- [x] 3.5 If an `active` agent has zero recorded versions yet (edge case), show the standard "No version history yet. Save your agent to create the first version." empty state
- [x] 3.6 Clicking a version entry opens the detail modal (see section 4) for that version

## 4. Version Detail Modal

- [x] 4.1 Scaffold the detail modal (nested template in `agent-history-panel`) showing: version number, timestamp, summary line
- [x] 4.2 Render the field-level diff using `diffAgentJson(previousVersion(versions, version)?.snapshot ?? null, version.snapshot)` from `version-diff.util.ts`, with added/removed/unchanged line styling
- [x] 4.3 Add a "Restore this version" button in the modal footer that emits `(restore)` with the selected `AgentVersion` and closes the modal + panel
- [x] 4.4 Add a close/dismiss control that closes only the modal, returning to the version list

## 5. Playground Editor Integration

- [x] 5.1 Add a "History" toggle button to the editor header in `playground-editor.component.html`, alongside Reset/Clone, independent of `activeTab`
- [x] 5.2 Add `historyPanelOpen` signal to `playground-editor.component.ts`; wire the toggle button and render `<app-agent-history-panel>` conditionally on it, passing `[agentId]="agentId()"` and `[agentStatus]="status()"`
- [x] 5.3 Implement `onRestoreVersion(version: AgentVersion)` handler: `form.patchValue({ agent_name, greeting, prompt, behavior, referral_amount, referral_currency })`, `tools.set(version.snapshot.tools)`, `mcpServers.set(version.snapshot.mcp_servers)` from `version.snapshot`; do not call `save()`
- [x] 5.4 After restoring, show a toast: `Restored to version #<N>. Save to keep these changes.` and close the history panel
- [x] 5.5 Confirm restoring invalidates any completed preview (existing `toolsWatcher`/form-changes effects already cover `tools`/`mcpServers`/form fields, so this should work without additional wiring — verify)

## 6. Verification

- [x] 6.1 Manually verify: a `draft` Playground agent's History panel shows the "tracked once live" empty state even after multiple saves
- [x] 6.2 Manually verify: going live creates the first version entry with summary "Went live"
- [x] 6.3 Manually verify: editing prompt/behavior/greeting/MCP servers/integrations on an already-Live agent and saving creates a new version with an accurate summary
- [x] 6.4 Manually verify: saving a Live agent with no actual changes does not create a new version entry
- [x] 6.5 Manually verify: the History toggle opens the panel from the Integrations, MCP Servers, and Preview tabs without switching tabs
- [x] 6.6 Manually verify: clicking a version entry opens a modal with correct summary + diff; Restore loads the snapshot into the form/signals, shows the toast, and closes panel + modal without auto-saving
- [x] 6.7 Manually verify: no console errors during the above flows; Agent Builder's existing Version History tab still works unchanged
