## ADDED Requirements

### Requirement: Active Sessions Tab
The system SHALL provide an "Active Sessions" tab in the Monitor Detail page, alongside the existing Overview, Call Log, Actions, and Reports tabs, listing the other calls currently in progress for that agent (per the `active-call-sessions` capability), each with a "Join" action. This tab SHALL be independent of the Call Log tab and Call Detail Modal, which remain scoped to historical calls only.

#### Scenario: Navigating to the Active Sessions tab while calls are in progress
- **WHEN** the user opens an agent's Monitor Detail page and clicks "Active Sessions" while that agent has calls in progress
- **THEN** the tab content lists each in-progress call with customer identity, direction, live duration, and a "Join" action

#### Scenario: Navigating to the Active Sessions tab with no calls in progress
- **WHEN** the user opens the Active Sessions tab for an agent with no calls currently in progress
- **THEN** an explicit empty state is shown rather than an empty or missing tab

#### Scenario: Joining a live call from the tab
- **WHEN** the user clicks "Join" on an entry in the Active Sessions tab
- **THEN** the page gives immediate visible feedback that the join was triggered for that specific session

#### Scenario: Active Sessions tab does not affect other tabs
- **WHEN** the Active Sessions tab is loading, empty, or populated
- **THEN** the Overview, Call Log, Actions, and Reports tabs and the Call Detail Modal are unaffected
