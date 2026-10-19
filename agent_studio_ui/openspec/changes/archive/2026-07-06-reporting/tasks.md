**Sequencing note**: these tasks assume `monitor-agents` has already been applied (its `CallRecord` model, `CallRecordService`, and `monitor-detail` component must exist first). Do not start this change's implementation before that one lands.

## 1. Report Model & Service

- [x] 1.1 Create `src/app/core/models/report.model.ts`: `ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom'`, `ReportRequest { agentId, period, startDate?, endDate? }`, `GeneratedReport { filename, rows: CallRecord[] }`.
- [x] 1.2 Create `src/app/core/services/report.service.ts`: `generateReport(request): Observable<GeneratedReport>` (pulls matching `CallRecord`s from `CallRecordService`/mock data for the computed date range, mock `delay(300)`), `sendReportEmail(report): Observable<void>`, `sendReportWhatsApp(report): Observable<void>` (both mock, no real send), `getFrequencyPreference(agentId)`/`setFrequencyPreference(agentId, frequency)` (mock persisted preference, stored in-memory like other mock services).
- [x] 1.3 Add a CSV-building helper (e.g. `toCsv(rows: CallRecord[]): string`) — no new library; join rows/columns manually or with minimal string building. (Exported directly from `report.service.ts` rather than a separate file, since it's only consumed by the report feature.)

## 2. Reports UI

- [x] 2.1 Scaffold `src/app/features/monitor-agents/agent-reports/agent-reports.component.ts/.html/.css`: period selector (Daily/Weekly/Monthly/Custom with date inputs for Custom), "Generate Report" button, and a frequency-preference selector with its own save action, clearly labeled as a preference (not automation).
- [x] 2.2 After generating, show a "Download", "Send via Email", and "Send via WhatsApp" set of actions for the generated report; download triggers a client-side CSV file download (e.g. via a `Blob` + temporary anchor click), named with the agent and period.
- [x] 2.3 Handle the no-leads-in-range case with a clear empty/zero-rows state rather than an error.
- [x] 2.4 Mount `AgentReportsComponent` inside the `monitor-agents` change's `monitor-detail` component, as a "Reports" section.

## 3. Verification

- [x] 3.1 Manually verify: selecting each period (Daily/Weekly/Monthly/Custom) computes the expected date range and "Generate Report" produces a report scoped to it. (Weekly correctly returned 136 leads for an active agent; a Custom range set to a past out-of-data window correctly returned "No leads in this period" rather than an error.)
- [x] 3.2 Manually verify: "Download" produces a real file download containing the expected leads as CSV rows; opening it in a spreadsheet app shows readable columns. (Verified via Playwright's download capture: correct filename `<agent>-<period>-report.csv`, header row + 136 data rows, comma-separated id/direction/occurred_at/outcome columns.)
- [x] 3.3 Manually verify: "Send via Email" / "Send via WhatsApp" show success toasts and don't attempt any real network delivery.
- [x] 3.4 Manually verify: setting a frequency preference persists across reopening the agent's detail view, and does not trigger any report generation on its own.
- [x] 3.5 Run `ng build` to confirm no regressions; check browser console for errors during the manual verification pass.
