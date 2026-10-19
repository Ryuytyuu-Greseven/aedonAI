## Context

`monitor-agents` (sibling change) introduces `CallRecord`/`CallRecordService` and a per-agent detail view (`monitor-detail`). `requirements/Main_Flow.txt` item 14 wants period-based report generation over that same call/lead data, downloadable and mock-delivered by email/WhatsApp. There is still no backend; every "backend" action in this app is a mock `Observable` with a simulated delay.

## Goals / Non-Goals

**Goals:**
- Generate a downloadable file of an agent's call leads for a chosen period, reusing `CallRecordService`'s underlying data rather than a third data source.
- Mock email/WhatsApp delivery consistent with the rest of the app's mock-API conventions.
- Store a schedule preference (frequency) without pretending to actually run a scheduled job — there's no backend process to run it.

**Non-Goals:**
- No real file delivery (email/WhatsApp), no real scheduler/cron, no server-side file generation.
- No true binary `.xlsx` generation — see the CSV decision below.
- No historical report archive/listing — each generation is a one-off action for this phase.

## Decisions

- **Reports are generated as CSV, not a binary `.xlsx`.** Item 14 says "excel," but a real `.xlsx` requires a binary-writing library (e.g. SheetJS `xlsx`, several hundred KB). `playground-mode` already hit a bundle-budget wall adding FontAwesome's JS bundle for a much smaller win; adding a binary spreadsheet writer for a mock report in a demo app is a worse trade. A CSV opens natively in Excel/Sheets/Numbers and satisfies "the customer gets a spreadsheet of their leads" without the dependency. **Flagging this explicitly — if a literal `.xlsx` file (not just Excel-openable) is a hard requirement, say so and this decision should be revisited.**
- **Report period reuses the same shape as the schedule preference** (`daily | weekly | monthly | custom`), with `custom` accepting an explicit start/end date. "Generate Report" always computes the date range from whichever period is currently selected and pulls matching `CallRecord`s via `CallRecordService`.
- **Schedule preference is stored on the agent (or a small per-agent report-settings record), not executed.** No job runs it; this is intentionally an honest half-measure — storing customer intent without simulating infrastructure that doesn't exist. The UI should not imply reports are auto-emailed on a timer, since they aren't.
- **Email/WhatsApp "delivery" is a mock API call + toast**, identical in shape to `AgentService`'s other mock mutations (`of(...).pipe(delay(300))`), with no attachment actually sent anywhere.
- **No formal spec delta against `monitor-agents`** (see proposal) — this change's own spec describes the integration point in prose; `agent-reports.component` is simply composed into `monitor-detail` at apply time.

## Risks / Trade-offs

- [CSV instead of real `.xlsx` may not literally satisfy "excel" if taken as a strict file-format requirement] → Explicitly flagged for the user; swapping in a real xlsx writer later is a contained change (isolated to `report.service.ts`'s file-generation step).
- [Storing an unexecuted "schedule" could read as a broken/incomplete feature if not labeled clearly] → Mitigation: implementation should label it as a preference (e.g., "Preferred report frequency") rather than implying automation, and keep "Generate Report" as the only actual action.
- [Sequencing dependency on `monitor-agents`] → This proposal is reviewable now, but its tasks must not be applied before `monitor-agents`'s tasks are applied; call this out at the top of `tasks.md` too.
