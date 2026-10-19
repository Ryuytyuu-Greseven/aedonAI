## MODIFIED Requirements

### Requirement: Draft and Live State
The system SHALL support two states for a Playground agent: `draft` and `active` (Live). Saving without explicitly marking an agent Live SHALL keep it in `draft`. An explicit "Go Live" action SHALL transition a `draft` agent to `active`, gated by a confirmation modal. "Go Live" SHALL only be reachable after a successful Preview in the current editing session, per the `agent-preview-call` capability; any subsequent edit invalidates that preview and requires a new one.

#### Scenario: Saving a new customization
- **WHEN** the user saves a template customization for the first time
- **THEN** the agent is created with status `draft` via a mock API call

#### Scenario: Go Live unavailable without a preview
- **WHEN** the user has not completed a successful Preview in this editing session
- **THEN** the "Go Live" action is disabled or hidden, even for a `draft` agent

#### Scenario: Requesting to go live after a successful preview
- **WHEN** the user has completed a successful Preview and clicks "Go Live" on a `draft` agent
- **THEN** a confirmation modal asks the user to confirm making the agent live

#### Scenario: Confirming go live
- **WHEN** the user confirms the "Go Live" modal
- **THEN** a mock API call transitions the agent's status to `active`

#### Scenario: Cancelling go live
- **WHEN** the user dismisses or cancels the "Go Live" confirmation modal
- **THEN** no API call is made and the agent remains `draft`

#### Scenario: Editing a Live agent
- **WHEN** the user edits and saves a Live (`active`) agent
- **THEN** the changes are persisted and the agent remains `active` (editing does not revert it to `draft`)
