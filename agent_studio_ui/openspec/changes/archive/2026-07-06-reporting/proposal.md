## Why

`requirements/Main_Flow.txt` item 14 is the last unbuilt Phase 4 item: the customer needs to generate a report of an agent's call leads for a chosen period (daily/weekly/monthly/custom), download it, and have it also delivered by email and WhatsApp — all "from backend" but mocked here, same as everything else in this app so far.

**Dependency note**: this change reuses `CallRecord`/`CallRecordService` introduced by the sibling `monitor-agents` change. `monitor-agents` must be applied first — this proposal is written and reviewable in parallel, but its tasks assume `monitor-agents`'s model/service already exist in the codebase.

## What Changes

- Add a "Reports" section to the Monitor Agents per-agent detail view: pick a period (Daily / Weekly / Monthly / Custom range), click "Generate Report" to produce a downloadable file of that period's call leads (id, direction, timestamp, outcome).
- Add mock "send to Email" / "send to WhatsApp" actions on a generated report (no real delivery — a mock API call + confirmation toast, consistent with every other mock action in this app).
- Add a per-agent "scheduled report" preference (frequency: daily/weekly/monthly) that's stored but not actually cron-triggered — there's no backend to run a schedule; storing the preference and letting the user generate on demand satisfies the mock scope without pretending to run a real job scheduler.

## Capabilities

### New Capabilities
- `reporting`: Period-based report generation, download, and mock email/WhatsApp delivery for an agent's call/lead data, plus a stored (non-executing) schedule preference.

### Modified Capabilities
(none — `monitor-agents` isn't synced into main specs yet since it's a sibling proposal; `reporting`'s requirements describe where it hooks into the Monitor Agents detail view without depending on editing that capability's not-yet-existing main spec file. Once both changes are applied, a future small delta could formalize the connection, but isn't required for this to be reviewable now.)

## Impact

- **Affected code**: new `src/app/features/monitor-agents/agent-reports/agent-reports.component.*` (mounted inside the existing `monitor-detail` view from `monitor-agents`), `src/app/core/services/report.service.ts` (mock generate/email/whatsapp), `src/app/core/models/report.model.ts`.
- **Dependencies**: report files are generated as CSV client-side (openable in Excel, no new library) rather than a true `.xlsx` binary — flagged as a judgment call in design.md, since adding a binary-Excel library is a real bundle-size trade-off for a mock feature (see the FontAwesome JS lesson from `playground-mode`).
- **Untouched**: everything in `monitor-agents` itself; this only adds a section to its detail view.
