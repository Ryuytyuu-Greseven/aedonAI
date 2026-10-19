## ADDED Requirements

### Requirement: History Side Panel

The system SHALL provide a "History" toggle in the Playground editor header that opens a side panel listing the agent's version history, per the `version-history` capability. The panel SHALL be reachable regardless of which editor tab (Build, Integrations, MCP Servers, Preview) is currently active, and SHALL NOT require the agent to be on any particular tab to open.

#### Scenario: Opening history from any tab
- **WHEN** the user clicks the "History" toggle while on the Integrations, MCP Servers, or Preview tab
- **THEN** the History side panel opens over the current tab's content without switching tabs

#### Scenario: Viewing history for a Live agent
- **WHEN** the user opens the History side panel for an `active` Playground agent that has been saved multiple times since going live
- **THEN** the panel lists each recorded version, newest first, per the `version-history` capability

#### Scenario: Viewing history for a Draft agent
- **WHEN** the user opens the History side panel for a `draft` Playground agent
- **THEN** the panel shows the empty state indicating history is tracked only once the agent goes live
