## ADDED Requirements

### Requirement: Live Agents List
The system SHALL display a list of all `active` (Live) agents in the Monitor Agents screen, each showing total call count, inbound count, and outbound count. Agents with status `draft` or `inactive` SHALL NOT appear.

#### Scenario: Viewing the monitor list
- **WHEN** the user opens Monitor Agents
- **THEN** only `active` agents are listed, each showing its total/inbound/outbound call counts

#### Scenario: No live agents
- **WHEN** no agent has status `active`
- **THEN** an empty state is shown instead of a list

### Requirement: Per-Agent Call Stats Detail
The system SHALL provide a per-agent detail view showing a day-by-day breakdown of inbound vs outbound call counts for a recent trailing window, aggregated rather than listing individual calls.

#### Scenario: Opening an agent's detail view
- **WHEN** the user opens an active agent's monitor detail
- **THEN** a day-by-day inbound/outbound breakdown is shown for the trailing window, with the same total/inbound/outbound summary as the list

#### Scenario: Scale with many calls
- **WHEN** an agent has dozens of calls on a given day
- **THEN** that day is represented as an aggregate count, not as one row per call

### Requirement: Inbound / Outbound Distinction
The system SHALL classify every call record as `inbound` or `outbound` and reflect that split in both the list and detail views.

#### Scenario: Contact-centre-style agent
- **WHEN** an agent's call records are mostly `inbound`
- **THEN** its inbound count is correspondingly higher than its outbound count in both views

#### Scenario: Sales-style agent
- **WHEN** an agent's call records are mostly `outbound`
- **THEN** its outbound count is correspondingly higher than its inbound count in both views
