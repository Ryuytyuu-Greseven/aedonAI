## ADDED Requirements

### Requirement: Export Destinations Section
The system SHALL provide an Export Destinations section within the Playground editor where the user can add, edit, and remove destinations per the `export-destinations` capability.

#### Scenario: Managing destinations while editing an agent
- **WHEN** the user opens the Export Destinations section of the Playground editor
- **THEN** the agent's current destinations are listed, with controls to add, edit, or remove them, consistent with the `export-destinations` capability

### Requirement: Clone Action In Editor
The system SHALL provide a "Clone" action in the Playground editor toolbar for any already-saved agent (draft or live), producing a new draft per the `agent-clone` capability and navigating to it.

#### Scenario: Cloning while editing
- **WHEN** the user clicks "Clone" in the Playground editor for a saved agent
- **THEN** a mock API call creates the clone, and the editor navigates to the new clone's own editor view
