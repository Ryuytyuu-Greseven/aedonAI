## Context

`CallRecord` (`src/app/core/models/call-record.model.ts`) currently has only `id`, `agent_id`, `direction`, `occurred_at`, `outcome` — enough for the existing aggregate Overview tab (day-by-day inbound/outbound bar chart) but nothing about what happened *during* a call. `CallRecordService` serves everything from `MOCK_CALL_RECORDS`, a deterministically-generated (seeded PRNG) array that can have 300+ entries for a busy agent across the 14-day mock window. `MonitorDetailComponent` already has a two-tab shell (`Overview` / `Reports`, `MonitorTab` type) that this change extends to three.

There is no existing transcript/tool-call/token/reasoning data anywhere in the app — the closest analog is Playground's live Preview call (`agent-preview-call` capability), which streams `{ speaker, text }` messages over a mock realtime channel for a call in progress. That capability is unrelated and untouched: this change is about **past, completed calls**, viewed on demand, not live streaming.

## Goals / Non-Goals

**Goals:**
- List every call for an agent in a paginated, filterable table (date range, direction, outcome) on a new "Call Log" tab.
- Clicking a row opens a modal with a single unified chronological timeline: messages, inline tool-execution cards, and collapsible per-turn AI reasoning.
- Show token usage (prompt/completion/total) and call duration, both in the table and the modal header, with tooltips clarifying what each figure means.
- Keep the list fast regardless of call volume: only generate the heavy per-call detail (transcript/tools/reasoning) when a specific call is opened, not for the whole list.

**Non-Goals:**
- No backend/API — everything is deterministic mock data, consistent with the rest of the app.
- No live/streaming call view — that's the existing, separate `agent-preview-call` capability.
- No transcript export/download, no editing or redacting past calls, no $-cost estimate — token *counts* only.
- No changes to the aggregate Overview tab or Reporting capability's existing behavior.

## Decisions

**Split lightweight list data from lazy detail data**: `CallRecord` gains two cheap scalar fields — `duration_seconds` and `total_tokens` — generated alongside the existing fields in the mock (deterministic, no extra cost), so the table can show duration/tokens columns without fetching anything extra. The expensive part (full conversation timeline, per-tool-call input/output, per-turn reasoning) lives in a new `CallDetail` type, fetched only when a row is clicked, via a new `CallRecordService.getCallDetail(callId)` method. This avoids generating and holding hundreds of full transcripts in memory just to render a list.

**Deterministic on-demand generation**: `getCallDetail(callId)` generates the `CallDetail` using a seeded PRNG derived from hashing `callId` (same `mulberry32`-style approach already used in `call-records.mock.ts`), so re-opening the same call in the same session always shows identical content — no need to cache/store full details for every record up front.

**Unified timeline as a flat, ordered union type**: rather than nesting tool calls inside message turns, `CallDetail.timeline` is a flat, chronologically-ordered array of `CallTimelineEvent`, a discriminated union of `{ kind: 'message', speaker, text, at, reasoning? }` and `{ kind: 'tool_execution', toolName, input, output, status, durationMs, at }`. This directly matches the chosen "unified chronological timeline" UX and keeps the renderer a single `@for` over one array with an `@switch` on `kind`, rather than juggling nested structures.

**Reasoning is per-agent-turn, optional, collapsed by default**: only `message` events with `speaker: 'agent'` may carry a `reasoning` string. The modal renders a "Show AI reasoning" toggle under each such turn (collapsed by default, matching how a reasoning/chain-of-thought aside is conventionally presented — visible on demand, not forced on the reader).

**Client-side pagination and filtering**: the new Call Log table reuses the existing `CallRecordService.getRecordsForAgent(agentId)` (already returns the agent's full record list; mock volumes top out in the low hundreds) and paginates/filters that array client-side in the new `CallLogComponent`. No new paginated/filtered service endpoint is introduced — consistent with how `agent-reports` already does client-side period selection over fetched data. Filters: date range (from/to), direction, outcome; page size fixed (e.g. 25/page) with prev/next controls.

**Tooltips via native `title` attributes**: the app has no existing tooltip component — `monitor-detail.component.html`'s chart segments already use plain `[title]="...">` for hover text. This change follows the same convention for the stat-pill tooltips (e.g. hovering "Tokens" explains prompt vs completion split) rather than introducing a new tooltip library/component.

**Modal shell reuses the existing scoped-CSS modal pattern** (`.modal-overlay` / `.modal`, as in `mcp-servers-manager` and `agent-history-panel`) but wider (e.g. `max-width: 900px`) and with a scrollable body, since it needs to hold a full conversation timeline — this is the "advanced modal" the request calls for, achieved by scaling up an existing, proven pattern rather than inventing a new modal primitive.

**Tab integration**: `MonitorTab` becomes `'overview' | 'reports' | 'call-log'`. The current binary `@if (activeTab() === 'overview') { ... } @else { ...reports... }` in `monitor-detail.component.html` becomes an explicit three-way `@if / @else if / @else`.

## Risks / Trade-offs

- [Generating a full timeline on every modal open (rather than caching) means re-opening the same call is cheap CPU-wise but re-does the PRNG walk each time] → Acceptable: the seeded PRNG makes output deterministic and the generation is trivial (no network), so there's no correctness or perceptible-latency concern; a `delay(300)` mirrors other mock service calls for a realistic loading state.
- [Client-side pagination/filtering means the whole per-agent record list is fetched up front] → Acceptable at current mock scale (low hundreds of rows, no pagination API exists elsewhere in the app either); documented so it isn't mistaken for a scalability guarantee if mock volumes grow substantially later.
- [Reasoning text is synthetic/mock, not a real model trace] → Expected and consistent with the rest of the app's mock-data approach; no real LLM calls are made anywhere in this frontend.

## Open Questions

- None blocking.
