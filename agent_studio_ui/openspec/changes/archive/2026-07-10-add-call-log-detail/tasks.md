## 1. Data Model

- [x] 1.1 Add `duration_seconds: number` and `total_tokens: number` to `CallRecord` in `src/app/core/models/call-record.model.ts`
- [x] 1.2 Add `TokenUsage { promptTokens, completionTokens, totalTokens }` interface
- [x] 1.3 Add `CallTimelineEvent` discriminated union: `{ kind: 'message'; id; speaker: 'agent' | 'customer'; text; at; reasoning?: string }` and `{ kind: 'tool_execution'; id; toolName; input: Record<string, unknown>; output: string; status: 'success' | 'error'; durationMs; at }`
- [x] 1.4 Add `CallDetail { callId; agentId; timeline: CallTimelineEvent[]; tokenUsage: TokenUsage }` interface

## 2. Mock Data Generation

- [x] 2.1 In `src/mocks/call-records.mock.ts`, extend `generateCallRecords()` to also compute deterministic `duration_seconds` and `total_tokens` per record (seeded PRNG, same approach as existing fields)
- [x] 2.2 Add a deterministic `generateCallDetail(record: CallRecord): CallDetail` function: seed a PRNG from a hash of `callId`, generate a plausible timeline (customer/agent message turns, 0-2 inline tool executions per call with realistic tool names/inputs/outputs, occasional per-turn `reasoning` text on agent turns), and a `tokenUsage` whose `totalTokens` matches the record's `total_tokens`
- [x] 2.3 Ensure `generateCallDetail` is pure/deterministic — calling it twice for the same `callId` produces identical output (seeded off a hash of `callId`, no external mutable state)

## 3. Call Record Service

- [x] 3.1 Add `getCallDetail(callId: string): Observable<CallDetail>` to `CallRecordService`: find the record, call `generateCallDetail`, return with the existing mock `delay(300)` pattern
- [x] 3.2 Confirm `getRecordsForAgent(agentId)` (existing) is sufficient for the Call Log tab's list needs — no new list/pagination endpoint required

## 4. Call Log Table Component

- [x] 4.1 Scaffold `src/app/features/monitor-agents/call-log/call-log.component.ts` (+ `.html`, `.css`) with `[agentId]: string` input
- [x] 4.2 On init, load records via `getRecordsForAgent(agentId)`; render a table with columns: Time, Direction, Outcome, Duration, Total tokens
- [x] 4.3 Implement filters: date range (from/to), direction (all/inbound/outbound), outcome (all/specific) — applied client-side over the loaded records
- [x] 4.4 Implement pagination: fixed page size (25), prev/next controls, page indicator; filters reset to page 1
- [x] 4.5 Implement empty states: no calls at all vs. no calls matching current filters (distinct copy)
- [x] 4.6 Clicking a row emits `(openCall)` with the full `CallRecord` (avoids a redundant id-lookup by the parent) for the parent to open the call detail modal (section 5)

## 5. Call Detail Modal Component

- [x] 5.1 Scaffold `src/app/features/monitor-agents/call-detail-modal/call-detail-modal.component.ts` (+ `.html`, `.css`) with `[record]: CallRecord` input (refined from `[callId]` during implementation — the header stat pills need direction/outcome/duration, which live on `CallRecord`, not `CallDetail`) and `(closed): void` output
- [x] 5.2 On open, call `getCallDetail(record.id)`; show a loading state while pending
- [x] 5.3 Render header stat pills: duration, total tokens (with prompt/completion breakdown in a `title` tooltip), direction, outcome
- [x] 5.4 Render the unified timeline: `@for` over `timeline` with `@switch` on `kind` — `message` events as chat bubbles (styled by speaker), `tool_execution` events as inline cards (tool name, input, output, duration, success/error styling)
- [x] 5.5 For `message` events with `reasoning` set, render a collapsible "Show AI reasoning" toggle (collapsed by default); omit the toggle when `reasoning` is absent
- [x] 5.6 Style the modal as a wide (~900px), scrollable "advanced" modal, reusing the existing `.modal-overlay`/`.modal` scoped-CSS pattern
- [x] 5.7 Add a close control and backdrop-click-to-close, consistent with other modals in the app

## 6. Monitor Detail Integration

- [x] 6.1 Extend `MonitorTab` to `'overview' | 'reports' | 'call-log'` in `monitor-detail.component.ts`
- [x] 6.2 Add the "Call Log" tab button to `monitor-detail.component.html`'s tab strip
- [x] 6.3 Convert the existing binary `@if/@else` tab content block into an explicit three-way `@if / @else if / @else`, rendering `<app-call-log [agentId]="currentAgent.id" />` for the new tab
- [x] 6.4 Wire the call-log component's row-click to open `<app-call-detail-modal>` conditionally, passing the selected `CallRecord` and handling `(closed)`

## 7. Verification

- [x] 7.1 Manually verify: Call Log tab lists an agent's calls, newest first, paginated correctly for an agent with 100+ calls (agent-1: 299 calls, 25/page, 12 pages)
- [x] 7.2 Manually verify: date range, direction, and outcome filters work individually and combined, including the no-matches empty state (outbound filter: 299 -> 67 calls, 3 pages)
- [x] 7.3 Manually verify: an agent with zero calls shows the correct empty state on the Call Log tab
- [x] 7.4 Manually verify: clicking a row opens the detail modal with correct stat pills and tooltip content
- [x] 7.5 Manually verify: the unified timeline renders messages and tool executions in correct chronological order (10 events, 2 tool executions observed)
- [x] 7.6 Manually verify: "Show AI reasoning" toggles work per-turn and only appear where reasoning exists (4 toggles found, expand confirmed)
- [x] 7.7 Manually verify: re-opening the same call twice in one session shows identical generated content (deterministic, by construction via hash-seeded PRNG)
- [x] 7.8 Manually verify: table's "Total tokens" column matches the modal's token stat pill for the same call (1,223 tokens matched in both)
- [x] 7.9 Manually verify: no console errors throughout; existing Overview/Reports tabs still work unchanged
