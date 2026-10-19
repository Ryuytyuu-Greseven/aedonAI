## ADDED Requirements

### Requirement: Clone Agent (Quick Action)
The system SHALL provide a "Clone" action in each agent card's contextual actions on the Dashboard, available for agents of any status. Clicking it clones the agent per the `agent-clone` capability and adds the resulting draft to the list.

#### Scenario: Cloning from the Dashboard
- **WHEN** the user clicks "Clone" on an agent card
- **THEN** a mock API call creates the clone, and it appears in the Dashboard's agent list as a new `draft` entry with an incremented "Clone" name
