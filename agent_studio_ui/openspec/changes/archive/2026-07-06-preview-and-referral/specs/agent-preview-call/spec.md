## ADDED Requirements

### Requirement: Preview Draft Agent
The system SHALL provide a "Preview" action on a `draft` agent that first saves the current in-progress customization (as `save` already does), then calls a mock API simulating the agent being invoked over a call, returning a simulated response/transcript displayed to the user.

#### Scenario: Previewing a draft agent
- **WHEN** the user clicks "Preview" on a `draft` agent
- **THEN** the current form state is saved, a mock API call simulates the agent handling a call, and a simulated transcript/response is displayed

#### Scenario: Preview unavailable before any save
- **WHEN** the user clicks "Preview" and the agent has never been saved
- **THEN** the system saves it for the first time as part of the preview action, the same way it would for an explicit "Save"

### Requirement: Preview Gates Go Live
The system SHALL only allow the "Go Live" action once a Preview has completed successfully in the current editing session. Any subsequent change to the agent's customization fields or export destinations SHALL invalidate the passed preview, requiring a new Preview before Go Live is reachable again.

#### Scenario: Go Live unavailable before preview
- **WHEN** the user opens a `draft` agent that has not been previewed in this session
- **THEN** the "Go Live" action is disabled or hidden

#### Scenario: Go Live available after a successful preview
- **WHEN** the user completes a Preview successfully
- **THEN** the "Go Live" action becomes available

#### Scenario: Editing after a successful preview invalidates it
- **WHEN** the user edits any field or export destination after a successful preview
- **THEN** "Go Live" becomes unavailable again until a new Preview completes successfully
