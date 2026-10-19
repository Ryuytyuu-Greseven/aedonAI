# Capability: Monitoring

## Purpose

Read-only call/lead statistics for agents, powering the Monitor Agents list and per-agent detail screens. Backs `CallRecordService`. Implemented per `../builder_config/backend-openspec/specs/monitoring/spec.md`.

**Scope boundary:** this capability covers only reads. `CallRecord` ingestion (how a call record actually gets created — telephony webhook, polling job, etc.) is explicitly undecided and out of scope; no write/ingest endpoint exists.

---

## Requirements

### Requirement: Per-Agent Call Stats
The system SHALL return a 14-day trailing rollup of call volume for a given agent, always well-formed (all-zero, not an error) even with no call history.

#### Scenario: Agent with calls
- **WHEN** `GET /api/agents/:id/calls/stats` is called for an agent with call records in the last 14 days
- **THEN** the system returns `{ agentId, total, inbound, outbound, byDay }` where `byDay` has exactly 14 entries, oldest first, each with counts for that calendar day

#### Scenario: Agent with no calls
- **WHEN** `GET /api/agents/:id/calls/stats` is called for an agent with zero call records
- **THEN** the system returns `{ agentId, total: 0, inbound: 0, outbound: 0, byDay: [14 zero entries] }`, not a `404`

#### Scenario: Unknown agent
- **WHEN** `GET /api/agents/:id/calls/stats` is called with an id that doesn't match any agent
- **THEN** the system returns `404`

### Requirement: Raw Call Records
The system SHALL return all call records for an agent, unfiltered by date, so callers (e.g. Reporting) can apply their own date range.

#### Scenario: Fetching records
- **WHEN** `GET /api/agents/:id/calls` is called for a valid agent
- **THEN** the system returns every `CallRecord` for that agent, most recent first

---

## Open decisions (unchanged from backend-openspec)

- Call record ingestion mechanism — no telephony/call provider has been chosen.
- International/per-country calling requirement (`Main_Flow.txt` item 11) — no corresponding field or behavior built; flagged, not guessed.
