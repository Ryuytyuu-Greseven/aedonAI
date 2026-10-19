## Why

Monitor Agents today only shows aggregate call counts (inbound/outbound totals, day-by-day). Customers need to drill into a *specific* call — see the actual conversation, which tools the agent invoked and what those tools returned, how many tokens the call consumed, and what the agent was "thinking" as it responded — to debug bad outcomes, verify tool behavior, and understand cost. None of that per-call detail exists in the data model or UI today.

## What Changes

- Add a **Call Log** tab to the existing Monitor Detail page (alongside Overview and Reports), listing every call for that agent in a paginated, filterable table (filters: date range, direction, outcome).
- Clicking a row opens an **advanced call detail modal** showing a single unified chronological timeline: customer/agent messages, inline tool-execution cards (tool name, input, output, latency), and a collapsible "Show AI reasoning" toggle under each agent turn — plus a header strip of stat pills (duration, total tokens, direction, outcome) with tooltips explaining each figure.
- Extend the call data model with per-call detail: transcript turns, tool executions, token usage (prompt/completion/total), and per-turn AI reasoning text. Detail is generated/fetched lazily per call (not eagerly for the whole list) to keep the list fast even for agents with hundreds of calls.
- All data remains mock, deterministic, and served through the existing `CallRecordService` pattern — no backend/API changes.

## Capabilities

### New Capabilities
- `call-log-detail`: Per-call log table (list, filter, paginate) and per-call detail view (conversation transcript, tool executions with responses, token usage, AI reasoning) for a single agent's calls.

### Modified Capabilities
- `monitor-agents`: Monitor Detail gains a third "Call Log" tab alongside Overview and Reports.

## Impact

- Affected frontend: `src/app/core/models/call-record.model.ts` (new per-call detail types), `src/app/core/services/call-record.service.ts` (new lazy detail-fetch method), `src/mocks/call-records.mock.ts` (deterministic per-call detail generation), `monitor-detail.component.ts`/`.html` (new tab), a new `call-log` list component and `call-detail-modal` component under `src/app/features/monitor-agents/`.
- No backend/API changes; all persistence and generation remains mocked, consistent with the rest of the app.
- No changes to Reporting or the aggregate Overview tab's existing behavior.
