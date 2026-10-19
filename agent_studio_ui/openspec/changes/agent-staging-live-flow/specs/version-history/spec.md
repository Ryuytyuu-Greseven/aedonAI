## MODIFIED Requirements

### Requirement: Agent-Level Version List

The system SHALL display a chronological list of saved agent snapshots. In Agent Builder this is the Version History tab, loaded from mock data. In the Playground editor this is a toggleable History side panel, reachable from the header regardless of which editor tab is active, loaded from the backend's agent history records per the `agent-lifecycle` capability. Each entry SHALL show: version number, timestamp (date + time), and a short summary of what changed (e.g., "Added node 'Classifier'", "Modified prompt on 'Router'", "Modified prompt", "Added MCP server 'Internal Ticketing'").

#### Scenario: Viewing version history in Agent Builder
- **WHEN** the user opens the Version History tab in Agent Builder
- **THEN** a list of past versions is shown, newest first, loaded from mock data

#### Scenario: Viewing version history in Playground
- **WHEN** the user opens the History side panel in the Playground editor
- **THEN** a list of past versions is shown, newest first, loaded from the agent's backend history records

#### Scenario: No history yet in Agent Builder
- **WHEN** the Agent Builder agent has never been saved
- **THEN** an empty state is displayed: "No version history yet. Save your agent to create the first version."

#### Scenario: No history yet in Playground
- **WHEN** the Playground agent has never been staged
- **THEN** an empty state is displayed: "No history yet. History is tracked once this agent is staged."

#### Scenario: Playground agent staged before has history regardless of current status
- **WHEN** the user opens the History side panel for a Playground agent that has been staged at least once, even if it is currently back in `draft` after an edit-triggered revert
- **THEN** the panel shows its recorded history rather than the empty state

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

The system SHALL rely on the backend to create a new archived version entry for a Playground agent whenever the agent is staged, goes live, or is edited while in a non-`draft` status (which reverts it to `draft`), per the `agent-lifecycle` capability. The frontend SHALL NOT create Playground agent-level version entries itself; the History panel simply reflects whatever the backend has recorded when opened or refreshed.

#### Scenario: Staging creates a new archived version on next transition
- **WHEN** a `draft` Playground agent is moved to staging and later staged again after edits (via the edit-reverts-to-draft path)
- **THEN** each prior staged configuration becomes a new entry in the agent's backend history, without any client-side version-save call

#### Scenario: Going live creates a version entry
- **WHEN** a `staged` Playground agent successfully transitions to `live` via "Go Live"
- **THEN** the backend records that transition in the agent's history; the frontend does not make a separate version-save call

#### Scenario: History panel reflects the backend without redundant local writes
- **WHEN** the user opens the History side panel after any stage/live/edit-revert transition
- **THEN** the panel's list is populated purely by reading the backend's history endpoint, with no locally-created entries merged in

---

### Requirement: Version History Mock Data

The system SHALL load Agent Builder's version history data (agent-level, per-node, and per-prompt) from a dedicated mocks file (`src/mocks/version-history.mock.ts` or equivalent) via `VersionHistoryService`. The Playground editor's agent-level History panel SHALL instead load its data from the backend's agent history endpoint per the `agent-lifecycle` capability, not from mock data.

#### Scenario: Loading Agent Builder version history from mock data
- **WHEN** the Agent Builder Version History tab or a node's history panel requests past versions
- **THEN** the data is read from the dedicated mocks file via `VersionHistoryService`, not hard-coded inline in any component

#### Scenario: Loading Playground version history from the backend
- **WHEN** the Playground editor's History side panel requests past versions for an agent
- **THEN** the data is read from the backend's agent history endpoint, not from the mocks file
