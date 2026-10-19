## MODIFIED Requirements

### Requirement: Draft and Live State
The system SHALL support four states for a Playground agent: `draft`, `staged`, `live`, and `disabled`, per the `agent-lifecycle` capability. Saving without explicitly staging an agent SHALL keep it in `draft`. An explicit "Move to Staging" action SHALL transition a `draft` agent to `staged`. An explicit "Go Live" action SHALL transition a `staged` agent to `live`, gated by a confirmation modal. "Go Live" SHALL only be reachable after a successful Preview of the staged configuration in the current editing session, per the `agent-preview-call` capability.

#### Scenario: Saving a new customization
- **WHEN** the user saves a template customization for the first time
- **THEN** the agent is created with status `draft` via an API call

#### Scenario: Moving a draft to staging
- **WHEN** the user triggers "Move to Staging" on a saved `draft` agent
- **THEN** an API call transitions the agent's status to `staged`, with no confirmation modal required

#### Scenario: Go Live unavailable without a preview
- **WHEN** the user has not completed a successful Preview of the current staged configuration in this editing session
- **THEN** the "Go Live" action is disabled or hidden, even for a `staged` agent

#### Scenario: Requesting to go live after a successful preview
- **WHEN** the user has completed a successful Preview and clicks "Go Live" on a `staged` agent
- **THEN** a confirmation modal asks the user to confirm making the agent live

#### Scenario: Confirming go live
- **WHEN** the user confirms the "Go Live" modal
- **THEN** an API call transitions the agent's status to `live`

#### Scenario: Cancelling go live
- **WHEN** the user dismisses or cancels the "Go Live" confirmation modal
- **THEN** no API call is made and the agent remains `staged`

#### Scenario: Editing a staged or live agent reverts it to draft
- **WHEN** the user edits and saves a `staged`, `live`, or `disabled` agent
- **THEN** the changes are persisted, the agent's current version is archived, and the agent's status becomes `draft` (per the `agent-lifecycle` capability's edit-reverts-to-draft requirement)

### Requirement: Preview Gates Go Live
The system SHALL only allow the "Go Live" action once a Call preview or a Chat preview for the current `staged` agent has completed successfully in the current editing session — either mode satisfies the requirement. Any change that causes the agent to revert to `draft` (any field, tool/integration, MCP server, or knowledge base link edit that gets saved) SHALL invalidate the passed preview and remove `staged` status, requiring the user to stage again and complete a new successful Call or Chat preview before Go Live is reachable.

#### Scenario: Go Live unavailable before any completed preview
- **WHEN** the user opens a `staged` agent that has not had a successful Call or Chat preview in this session
- **THEN** the "Go Live" action is disabled or hidden

#### Scenario: Go Live available after a successful Call preview
- **WHEN** the active Call preview ends with outcome `completed`
- **THEN** the "Go Live" action becomes available

#### Scenario: Go Live available after a successful Chat preview
- **WHEN** the user ends a Chat preview session that had at least one real exchange
- **THEN** the "Go Live" action becomes available

#### Scenario: Go Live unavailable after a failed Call preview
- **WHEN** the active Call preview ends with outcome `failed`
- **THEN** the "Go Live" action remains disabled or hidden (a failed Call preview does not satisfy the gate, and Chat has no failure outcome)

#### Scenario: Saving an edit after a successful preview invalidates it
- **WHEN** the user edits and saves any field, tool/integration, MCP server, or knowledge base link after a successful Call or Chat preview on a `staged` agent
- **THEN** the agent reverts to `draft`, the preview is invalidated, and the user must move it to staging and complete a new successful Call or Chat preview before Go Live is reachable again

### Requirement: History Side Panel
The system SHALL provide a "History" toggle in the Playground editor header that opens a side panel listing the agent's version history, per the `version-history` capability. The panel SHALL be reachable regardless of which editor tab (Build, Integrations, MCP Servers, Preview) is currently active, and SHALL NOT require the agent to be on any particular tab to open. The panel's contents SHALL reflect whether the agent has ever been staged, not its current status.

#### Scenario: Opening history from any tab
- **WHEN** the user clicks the "History" toggle while on the Integrations, MCP Servers, or Preview tab
- **THEN** the History side panel opens over the current tab's content without switching tabs

#### Scenario: Viewing history for an agent that has been staged before
- **WHEN** the user opens the History side panel for a Playground agent that has been staged and/or gone live at least once, regardless of its current status
- **THEN** the panel lists each recorded version, newest first, per the `version-history` capability

#### Scenario: Viewing history for an agent never staged
- **WHEN** the user opens the History side panel for a Playground agent that has never been staged
- **THEN** the panel shows the empty state indicating history is tracked only once the agent is staged
