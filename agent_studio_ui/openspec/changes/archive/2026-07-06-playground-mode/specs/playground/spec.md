## ADDED Requirements

### Requirement: Template Selection
The system SHALL present all templates from the static agent catalog as selectable cards at `/playground/new`. Selecting a template SHALL initialize a new agent pre-filled with that template's default name, greeting, prompt, and behavior, and marked `enable_voice: true` by default.

#### Scenario: Starting a new agent from a template
- **WHEN** the user selects a template card
- **THEN** the Playground editor opens with all fields pre-populated from that template's defaults and `enable_voice` set to `true`

### Requirement: Customize Agent Configuration
The system SHALL allow the user to edit the agent's display name, call greeting, behavior prompt, and behavior configuration for any template-based agent. Fields left unedited SHALL retain the template's default value.

#### Scenario: Editing the greeting
- **WHEN** the user changes the greeting field and saves
- **THEN** the saved agent uses the custom greeting on subsequent loads instead of the template default

#### Scenario: Leaving a field untouched
- **WHEN** the user saves without editing the prompt field
- **THEN** the saved agent's prompt equals the template's default prompt

### Requirement: Reset to Template Default
The system SHALL provide a reset action, available per-field and for the whole agent, that restores the template's default value(s), discarding any customization.

#### Scenario: Resetting a single field
- **WHEN** the user clicks "Reset" next to the greeting field
- **THEN** only the greeting field reverts to the template default; other customized fields are unaffected

#### Scenario: Resetting the whole agent
- **WHEN** the user clicks "Reset to default" at the agent level
- **THEN** name, greeting, prompt, and behavior configuration all revert to the selected template's defaults

### Requirement: Draft and Live State
The system SHALL support two states for a Playground agent: `draft` and `active` (Live). Saving without explicitly marking an agent Live SHALL keep it in `draft`. An explicit "Go Live" action SHALL transition a `draft` agent to `active`, gated by a confirmation modal.

#### Scenario: Saving a new customization
- **WHEN** the user saves a template customization for the first time
- **THEN** the agent is created with status `draft` via a mock API call

#### Scenario: Requesting to go live
- **WHEN** the user clicks "Go Live" on a `draft` agent
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

### Requirement: Drafted Agents List
The system SHALL list all `draft`-status Playground agents in a dedicated "Drafted" section within the Playground, separate from the main Dashboard's full agent list.

#### Scenario: Viewing drafts
- **WHEN** the user opens the Playground's Drafted section
- **THEN** all agents with status `draft` are listed with their template name and last-modified time

### Requirement: Default Fallback Behavior
The system SHALL apply the template's default name, greeting, and prompt whenever the corresponding customization field is empty, ensuring an agent is never created with a blank behavior definition.

#### Scenario: Blank custom greeting
- **WHEN** the user clears the greeting field entirely and saves
- **THEN** the system falls back to the template's default greeting for that agent rather than saving an empty value

### Requirement: Cancel Editing
The system SHALL provide a "Cancel" action in the Playground editor that discards in-progress edits and navigates away without saving.

#### Scenario: Cancel a not-yet-saved new agent
- **WHEN** the user clicks "Cancel" while customizing a template that has not yet been saved
- **THEN** the system navigates back to the template picker (`/playground/new`) without creating an agent

#### Scenario: Cancel while editing an existing agent
- **WHEN** the user clicks "Cancel" while editing an already-saved agent
- **THEN** the system navigates to the Dashboard without persisting any unsaved field changes
