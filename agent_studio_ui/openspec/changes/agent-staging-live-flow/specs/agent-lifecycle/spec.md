## ADDED Requirements

### Requirement: Agent Status Vocabulary
The system SHALL model an agent's status as exactly one of `draft`, `staged`, `live`, or `disabled`, matching the backend's lifecycle. No other status value SHALL be read, written, or displayed anywhere in the frontend.

#### Scenario: New agent starts as draft
- **WHEN** an agent is created from a template
- **THEN** its status is `draft`

#### Scenario: Status values are exhaustive
- **WHEN** any part of the frontend renders or branches on an agent's status
- **THEN** it handles exactly the four values `draft`, `staged`, `live`, `disabled` and no others

### Requirement: Move Draft Agent to Staging
The system SHALL provide a "Move to Staging" action, available only on agents with status `draft`, that calls the backend's stage endpoint and updates the agent's status to `staged` on success.

#### Scenario: Staging a draft agent
- **WHEN** the user triggers "Move to Staging" on a `draft` agent
- **THEN** the system calls the stage endpoint for that agent and, on success, updates the local status to `staged`

#### Scenario: Staging is unavailable for a non-draft agent
- **WHEN** an agent's status is `staged`, `live`, or `disabled`
- **THEN** no "Move to Staging" action is shown for it

#### Scenario: Stage request fails
- **WHEN** the stage endpoint call fails
- **THEN** the agent's local status is left unchanged and an error message is shown to the user

### Requirement: Preview Required Before Go Live
The system SHALL only allow the "Go Live" action when the agent's status is `staged` and a preview has completed successfully for the current staged configuration in this editing session. Triggering "Go Live" SHALL call the backend's live endpoint; the backend independently re-validates the preview via a stored hash and SHALL reject the request (leaving the agent `staged`) if the configuration has changed since the last preview.

#### Scenario: Go Live blocked without a completed preview
- **WHEN** the agent is `staged` but no preview has completed successfully in this session
- **THEN** the "Go Live" action is disabled or hidden

#### Scenario: Go Live succeeds after a fresh preview
- **WHEN** the agent is `staged`, a preview has completed successfully, and the user confirms "Go Live"
- **THEN** the system calls the live endpoint and, on success, updates the local status to `live`

#### Scenario: Go Live rejected for a stale preview
- **WHEN** the user confirms "Go Live" but the backend responds that the configuration has changed since the last preview
- **THEN** the agent's local status remains `staged`, the preview-passed flag is cleared, and an error message explains a new preview is required

#### Scenario: Preview unavailable outside staged status
- **WHEN** the agent's status is not `staged`
- **THEN** the Preview (Call/Chat) form is not available for that agent

### Requirement: Disable and Enable a Live Agent
The system SHALL provide a "Disable" action, available only when status is `live`, and an "Enable" action, available only when status is `disabled`, each calling the corresponding backend endpoint and updating local status on success.

#### Scenario: Disabling a live agent
- **WHEN** the user triggers "Disable" on a `live` agent and confirms
- **THEN** the system calls the disable endpoint and, on success, updates the local status to `disabled`

#### Scenario: Re-enabling a disabled agent
- **WHEN** the user triggers "Enable" on a `disabled` agent and confirms
- **THEN** the system calls the enable endpoint and, on success, updates the local status to `live`

#### Scenario: No enable/disable action for draft or staged agents
- **WHEN** an agent's status is `draft` or `staged`
- **THEN** neither "Disable" nor "Enable" is shown for it

### Requirement: Editing a Non-Draft Agent Reverts It to Draft
The system SHALL warn the user before saving an edit to a `staged`, `live`, or `disabled` agent that the save will move the agent back to `draft` and archive its current version, since the backend performs this reversion automatically on any update to a non-draft agent. After a successful save, the system SHALL trust and display the status returned by the backend rather than assuming the prior status is retained.

#### Scenario: Warning before editing a staged agent
- **WHEN** the user attempts to save changes to a `staged` agent
- **THEN** a confirmation is shown explaining the agent will revert to `draft`, before the save request is made

#### Scenario: Warning before editing a live agent
- **WHEN** the user attempts to save changes to a `live` agent
- **THEN** a confirmation is shown explaining the agent will revert to `draft`, before the save request is made

#### Scenario: Declining the warning cancels the save
- **WHEN** the user is shown the revert-to-draft warning and cancels it
- **THEN** no save request is made and the agent's data and status are unchanged

#### Scenario: Status reflects server response after save
- **WHEN** a save of a previously `staged` or `live` agent completes successfully
- **THEN** the agent's displayed status becomes `draft`, matching the backend response

#### Scenario: Editing a draft agent needs no warning
- **WHEN** the user saves changes to an agent that is already `draft`
- **THEN** no revert warning is shown and the save proceeds as a normal update

### Requirement: Agent History By Agent ID
The system SHALL provide a way to retrieve an agent's full archived version history — one entry per stage/live version that was superseded by staging, going live, or an edit-triggered revert — keyed by the agent's identifier, newest version first.

#### Scenario: Retrieving history for an agent with prior versions
- **WHEN** the system requests history for an agent that has been staged and/or gone live at least once
- **THEN** it receives a list of archived version entries ordered from most to least recent

#### Scenario: Retrieving history for an agent with no prior versions
- **WHEN** the system requests history for an agent that has never been staged
- **THEN** it receives an empty list

### Requirement: Live Agent Records Are Not Independently Browsable
The system SHALL NOT provide a dedicated list or detail screen for the backend's separate live-agent records; a live agent's current configuration SHALL be viewed and edited through its originating draft/staged/live agent entry only.

#### Scenario: No standalone live-agent listing
- **WHEN** a user looks for a way to browse "live agents" as their own collection in the UI
- **THEN** no such screen exists; live status is instead reflected on the same agent entry used throughout the rest of the app
