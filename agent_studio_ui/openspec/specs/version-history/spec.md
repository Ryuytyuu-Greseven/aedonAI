# Capability: Version History

## Purpose

Version History gives users a full audit trail of changes to an agent over time, at three levels of granularity: whole-agent snapshots, per-node snapshots (including prompt history), and tool snapshots. Users can review past states and restore a previous version of the agent, a node, or just a prompt. All version data is stored as mock static data in the mocks file.

---

## Requirements

### Requirement: Agent-Level Version List

The system SHALL display a chronological list of saved agent snapshots. In Agent Builder this is the Version History tab; in the Playground editor this is a toggleable History side panel, reachable from the header regardless of which editor tab is active. Each entry SHALL show: version number, timestamp (date + time), and a short summary of what changed (e.g., "Added node 'Classifier'", "Modified prompt on 'Router'", "Modified prompt", "Added MCP server 'Internal Ticketing'").

#### Scenario: Viewing version history
- **WHEN** the user opens the Version History tab (Agent Builder) or the History side panel (Playground)
- **THEN** a list of past versions is shown, newest first, loaded from mock data

#### Scenario: No history yet
- **WHEN** the agent has never been saved, or (in Playground) has never gone live
- **THEN** an empty state is displayed: "No version history yet. Save your agent to create the first version." (Agent Builder) or "No history yet. History is tracked once this agent goes live." (Playground)

#### Scenario: Draft Playground agent has no history
- **WHEN** the user opens the History side panel for a Playground agent whose status is `draft`
- **THEN** the panel shows the "History is tracked once this agent goes live" empty state, even if the agent has been saved multiple times

---

### Requirement: Version Detail View

The system SHALL allow the user to click a version entry to see a detailed diff-like view of that version: a snapshot of the full agent JSON at that point, with changed fields highlighted (added in green, removed in red, unchanged in neutral). In Agent Builder this detail is shown inline in a side `<aside>`; in Playground it is shown in a modal.

#### Scenario: Viewing a specific version
- **WHEN** the user clicks on a version entry
- **THEN** a side panel or modal opens showing the version's summary line and a diff of the agent JSON relative to the immediately preceding version

#### Scenario: Viewing a version's detail modal in Playground
- **WHEN** the user clicks a version entry in the Playground History side panel
- **THEN** a modal opens showing the version number, timestamp, its change summary, and the field-level diff versus the prior version, with a "Restore this version" action in the footer

---

### Requirement: Restore Agent Version

The system SHALL allow the user to restore the agent to a previous version via a "Restore this version" action on the version detail view. Restoring does not auto-save; it loads the snapshot's data into the in-memory editor state (in Agent Builder: nodes, tools, agent metadata; in Playground: greeting, prompt, behavior, referral bonus, tools/integrations, and MCP servers) so the user can review and then explicitly save.

#### Scenario: Restoring a version
- **WHEN** the user clicks "Restore this version" on a past snapshot
- **THEN** the editor's in-memory state is replaced with the snapshot's data, and a toast says "Restored to version #<N>. Save to keep these changes."

#### Scenario: Restoring and then discarding
- **WHEN** the user restores a version but then navigates away without saving
- **THEN** the restored state is discarded and the agent remains at its last persisted version

#### Scenario: Restoring in Playground closes the panel
- **WHEN** the user restores a version from the Playground History detail modal
- **THEN** the modal and the History side panel both close, returning the user to the editor form to review the restored fields and save

---

### Requirement: Playground Version Creation Trigger

The system SHALL create a new `AgentVersion` entry for a Playground agent only when that agent is Live (`active`), not while it is `draft`. The first entry SHALL be created at the moment a `draft` agent successfully goes live. Every subsequent successful save of an already-`active` agent SHALL create a new entry, but only if the saved agent actually differs from the latest recorded version's snapshot; saves that produce no effective change SHALL NOT create a new entry.

#### Scenario: Going live creates the first version
- **WHEN** a `draft` Playground agent successfully transitions to `active` via "Go Live"
- **THEN** a new `AgentVersion` entry is created for that agent with a summary such as "Went live"

#### Scenario: Editing a Live agent creates a new version
- **WHEN** the user edits the prompt of an already-`active` Playground agent and saves
- **THEN** a new `AgentVersion` entry is created summarizing the change (e.g., "Modified prompt")

#### Scenario: Saving a draft creates no version
- **WHEN** the user saves a `draft` Playground agent (without going live)
- **THEN** no `AgentVersion` entry is created for that save

#### Scenario: Saving a Live agent with no changes creates no version
- **WHEN** the user clicks Save on an already-`active` Playground agent without modifying any field, tool, integration, or MCP server since the last recorded version
- **THEN** no new `AgentVersion` entry is created

---

### Requirement: Playground-Relevant Change Summaries

The system SHALL generate change summaries that describe edits meaningful to the Playground editor — changes to `prompt`, `behavior`, `greeting`, `mcp_servers` (added/removed by name), and tools/integrations (added/removed by name) — in addition to the existing agent-name/node/tool-addition coverage, so that Playground version summaries do not universally read as "Minor updates".

#### Scenario: Prompt change summarized
- **WHEN** a new version is created for a Playground agent whose `prompt` differs from the previous version's snapshot
- **THEN** the version's summary includes "Modified prompt"

#### Scenario: MCP server addition summarized
- **WHEN** a new version is created for a Playground agent that has a new entry in `mcp_servers` compared to the previous version
- **THEN** the version's summary includes `Added MCP server "<name>"`

#### Scenario: Integration removal summarized
- **WHEN** a new version is created for a Playground agent where a previously-present tool/integration is no longer present
- **THEN** the version's summary includes `Removed integration "<name>"`

---

### Requirement: Per-Node Version History

The system SHALL display a version history specific to each node within the node configuration panel (accessible via a "History" icon or link in the node panel). Node history entries SHALL show: timestamp, prompt snapshot, tool assignments at that time.

#### Scenario: Viewing node history
- **WHEN** the user opens a node panel and clicks the history icon
- **THEN** a list of past states for that node is shown, with timestamps and prompt previews (first 80 chars), loaded from mock data

#### Scenario: Comparing node prompt history
- **WHEN** the user clicks a specific node history entry
- **THEN** the past prompt text is shown in a read-only textarea beside the current prompt text for comparison

---

### Requirement: Prompt-Level Version History

The system SHALL display a prompt-specific history within the node configuration panel. Each time the agent is saved and the prompt has changed, a new prompt snapshot is stored. The user can view old prompts and click "Use this prompt" to restore just the prompt text.

#### Scenario: Restoring a past prompt
- **WHEN** the user clicks "Use this prompt" on a historical prompt entry
- **THEN** the node's prompt textarea is populated with the historical text and marked as an unsaved change; the agent-level "Unsaved changes" indicator appears

#### Scenario: No prompt history
- **WHEN** a node's prompt has never been changed since creation
- **THEN** the prompt history section shows "No prompt history yet."

---

### Requirement: Version History Mock Data

The system SHALL load all version history data from a dedicated mocks file (`src/mocks/version-history.mock.ts` or equivalent). No version data SHALL be hard-coded in component files.

#### Scenario: Loading version history from mock data
- **WHEN** the Version History tab or a node's history panel requests past versions
- **THEN** the data is read from the dedicated mocks file via `VersionHistoryService`, not hard-coded inline in any component
