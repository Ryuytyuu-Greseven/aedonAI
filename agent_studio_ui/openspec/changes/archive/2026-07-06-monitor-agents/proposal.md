## Why

`requirements/Main_Flow.txt` items 19–21 describe the last major screen not yet built: once agents are live, the customer needs to monitor them — call volume per day, and the inbound/outbound split (a Contact Centre agent runs mostly inbound; a Sales agent runs mostly outbound/campaign calls). The `nav-shell` capability already reserved a slot for this ("Monitor Agents entry added in a later phase").

## What Changes

- Add a Monitor Agents screen listing only `active` (Live) agents, each with aggregate call stats: total calls, inbound count, outbound count, and calls-per-day for a recent window.
- Add a per-agent detail view showing the day-by-day call breakdown (inbound vs outbound), designed to stay legible at the stated scale (~10 active agents, ~50–100 calls/agent/day) — i.e., aggregated/charted, not a raw scrolling list of every call.
- Add a mock call-log data source (a dedicated mocks file) so stats aren't fabricated ad hoc in components.
- Wire a "Monitor Agents" entry into the `nav-shell`'s right-edge flyout, filling the slot already reserved for it.

## Capabilities

### New Capabilities
- `monitor-agents`: Live-agent call statistics — list view, per-agent inbound/outbound/day breakdown, backed by mock call-log data.

### Modified Capabilities
- `nav-shell`: adds the "Monitor Agents" navigation entry (previously a placeholder) to the Right-Edge Hover Flyout Navigation requirement.

## Impact

- **Affected code**: new `src/mocks/call-records.mock.ts`, `src/app/core/models/call-record.model.ts`, `src/app/core/services/call-record.service.ts`, new `src/app/features/monitor-agents/**`, `src/app/shared/nav-shell/nav-shell.component.ts` (new nav item), `src/app/app.routes.ts` (new `/monitor` route).
- **Untouched**: Dashboard, Playground, and all existing capabilities — this is purely additive, read-only reporting over existing agent + new call-log mock data.
- **Dependencies**: none new; mock data + existing chart-free card/table patterns already used elsewhere (no charting library added — see design.md for the rationale).
