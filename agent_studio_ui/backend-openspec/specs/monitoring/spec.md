# Monitoring API

## Purpose

Read-only call/lead statistics for `active` agents, powering the Monitor Agents list and per-agent detail screens. Backs `src/app/core/services/call-record.service.ts`.

**Scope boundary — read this first:** this spec covers only the **read** endpoints the frontend calls. It does **not** cover how `CallRecord` rows get created in the first place — that's a telephony/call-provider integration (whatever actually places/receives the calls), which is entirely out of scope for this document and was never assigned anywhere in the project's requirements. See "Open decisions" below; do not invent an ingestion mechanism without a real decision from the product owner.

---

## Data shapes

```ts
type CallDirection = 'inbound' | 'outbound';
type CallOutcome = 'lead' | 'no_answer' | 'completed';

// Wire shape (call-record-mapper.ts) — raw Mongo document, `_id` not `id`. Every other field
// matches the frontend model's snake_case names as-is.
interface ApiCallRecord {
  _id: string;
  agent_id: string;
  direction: CallDirection;
  occurred_at: string;      // ISO 8601
  outcome: CallOutcome;
  duration_seconds: number;
  total_tokens: number;
  phone_number: string;
  customer_name: string | null;
  cost_usd: number;
}

// Frontend model (call-record.model.ts) — `fromApiCallRecord()` maps `_id` → `id`.
interface CallRecord {
  id: string;
  agent_id: string;
  direction: CallDirection;
  occurred_at: string;      // ISO 8601
  outcome: CallOutcome;
  duration_seconds: number;
  total_tokens: number;
  phone_number: string;
  customer_name: string | null;
  cost_usd: number;
}

interface DayCallStats {
  date: string;              // YYYY-MM-DD
  inbound: number;
  outbound: number;
}

interface AgentCallStats {
  agentId: string;
  total: number;
  inbound: number;
  outbound: number;
  byDay: DayCallStats[];      // trailing 14 days, oldest first
}
```

## GET /api/agents/:id/calls/stats

Backs `CallRecordService.getStatsForAgent(agentId): Observable<AgentCallStats>`. Powers both the Monitor Agents list (called once per active agent) and the per-agent detail view's stat tiles + day-by-day chart.

**Auth required:** Yes.
**Query params:** none currently (the frontend hardcodes a 14-day trailing window client-side in the mock). Consider adding `?days=14` so the frontend can request other windows later without an API change — not required for current behavior.

**Response 200:** `AgentCallStats`

#### Scenario: Agent with no calls yet
- **WHEN** an agent has zero call records
- **THEN** return `{ agentId, total: 0, inbound: 0, outbound: 0, byDay: [...14 entries all zero] }`, not an error — the frontend's empty-state handling expects a well-formed zero response, not a 404

## GET /api/agents/:id/calls

Backs `CallRecordService.getRecordsForAgent(agentId): Observable<CallRecord[]>`. Used indirectly by Reporting (see `reporting/spec.md`) to build a report for an arbitrary date range — the stats endpoint above only covers a fixed trailing window, so Reporting needs the raw records to filter by its own period.

**Response 200:** `ApiCallRecord[]` (mapped to `CallRecord[]` client-side via `fromApiCallRecord`) — all records for the agent, unfiltered by date (the caller filters client-side today; consider adding `?from=&to=` query params as a real-scale optimization once record volume matters — item 20 in the original requirements explicitly anticipates ~10 agents × 50-100 calls/day, which is small enough that unfiltered-then-filter-in-memory is fine to start with, but won't stay fine indefinitely).

---

## Open decisions

- **Call record ingestion.** Nothing in this project has ever specified how a `CallRecord` actually gets created — i.e., which telephony/call platform this integrates with, whether it's a webhook from that provider, a polling job, or something else. This is a real infrastructure decision requiring product/business input, not something inferable from the frontend.
- **`requirements/Main_Flow.txt` item 11: "these agents are voice agents by default, and over the call in any country."** This was never assigned to any phase of frontend work and has no corresponding UI anywhere in the app today (no country/region field exists on `Agent` or anywhere else). It most likely describes a requirement on the telephony provider (e.g., a provider with international calling/number-provisioning support, per-country compliance for outbound calling, etc.) rather than something this API needs to expose — but that's a guess, not a decision. Flag this back to the product owner; don't build speculative country-selector UI or backend fields for it without a real answer, since guessing wrong here means reworking both the API and the frontend.
- **Retention/volume.** At the stated scale (~10 agents × 50-100 calls/day) this is a small table indefinitely unless the customer base grows a lot — no indexing/partitioning strategy is prescribed here since it's premature at this volume, but worth revisiting if usage grows past the numbers in the original requirements.
