## Context

There is no call/lead data anywhere in the app today — `Agent` tracks configuration, not usage. `requirements/Main_Flow.txt` items 19–21 need a monitoring surface over "how many calls, inbound vs outbound, per day" for live agents only. The `nav-shell` capability (from `playground-mode`) already left an explicit slot for this: task 5.2 said "Monitor Agents entry added in a later phase; leave a straightforward place to add it."

## Goals / Non-Goals

**Goals:**
- Introduce a minimal call-log mock data model (leads/call metadata only, no transcripts — item 19 explicitly says "not conversations, just leads").
- Show only `active` agents in Monitor Agents (a `draft` or `inactive` agent isn't taking calls, so has nothing to monitor).
- Keep the per-agent view legible at the stated scale (~10 agents × ~50–100 calls/agent/day) via aggregation (daily counts, inbound/outbound split) rather than a raw per-call list.

**Non-Goals:**
- No real telephony data, no charting library dependency — day-by-day bars are built with plain CSS (a row of proportionally-sized divs), consistent with the app's existing hand-rolled component style; this keeps bundle size down for a small, fixed-shape visualization.
- No cross-agent comparison dashboards, no date-range picker beyond a fixed recent window (e.g., last 14 days) — out of scope until asked for.
- No live/real-time updates — mock data is static per session, same as every other mock service.

## Decisions

- **New `CallRecord` model, not bolted onto `Agent`.** `{ id, agent_id, direction: 'inbound' | 'outbound', occurred_at, outcome: 'lead' | 'no_answer' | 'completed' }` — a flat, independent collection (own mocks file, own service), mirroring how `AgentTemplate`/`Tool` are modeled as their own things rather than crammed into `Agent`.
- **Mock fixture data is authored to match the flavor text in item 21**: Contact Centre-based agents skew inbound-heavy, Sales-based agents skew outbound/campaign-heavy, matching "if it's a contact centre we will have many inbound calls and if it's sales agent will have campaign calls" — this is a content-authoring detail (task-level), not a system requirement, since the system just needs to correctly display whatever the data says.
- **Aggregation happens in `CallRecordService`, not pre-baked into the fixtures** — `getStatsForAgent(agentId)` computes total/inbound/outbound/per-day counts from the raw `CallRecord[]`, the same "service computes from raw list" pattern `DashboardComponent`'s `counts` computed signal already uses for status counts.
- **List view shows only `active` agents**, reusing `AgentService.getAgents()` filtered client-side — no new agent-fetching endpoint needed.
- **Per-day breakdown covers a fixed trailing window (14 days)** rendered as simple stacked/grouped bars using CSS `height`/`flex` proportional to count, styled with existing theme tokens — no chart library. Implementation will follow this repo's `dataviz` skill guidance (categorical color usage, accessible contrast, tooltip/label conventions) when building the actual bars and stat tiles.
- **New `/monitor` and `/monitor/:agentId` routes**, guarded by `authGuard` like every other protected route, with a `nav-shell` entry filling the reserved slot.

## Risks / Trade-offs

- [Hand-rolled CSS bars instead of a charting library could look primitive next to a real product] → Acceptable for a mock phase; matches the project's stated preference (`product.md`: "do not create unnecessary files... follow design principles") over adding a charting dependency for a fixed, simple shape.
- [14-day fixed window may not match whatever daily/weekly/monthly reporting periods Phase 4 (`reporting`) introduces] → Both changes are being proposed together specifically so `reporting` can reuse `CallRecord`/`CallRecordService` instead of inventing a second data source; the reporting change's design should reference this one.
