## MODIFIED Requirements

### Requirement: Live Agents List
The system SHALL display a list of all `live` agents in the Monitor Agents screen, each showing total call count, inbound count, and outbound count. Agents with status `draft`, `staged`, or `disabled` SHALL NOT appear.

#### Scenario: Viewing the monitor list
- **WHEN** the user opens Monitor Agents
- **THEN** only `live` agents are listed, each showing its total/inbound/outbound call counts

#### Scenario: No live agents
- **WHEN** no agent has status `live`
- **THEN** an empty state is shown instead of a list
