# Reporting API

## Purpose

Period-based report generation, download, and mock email/WhatsApp delivery of an agent's call/lead data, plus a stored (currently non-executing) frequency preference. Backs `src/app/core/services/report.service.ts`.

---

## Data shapes

```ts
type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
type ReportFrequency = 'daily' | 'weekly' | 'monthly';

interface ReportRequest {
  agentId: string;
  period: ReportPeriod;
  startDate?: string;   // YYYY-MM-DD, required when period === 'custom'
  endDate?: string;     // YYYY-MM-DD, required when period === 'custom'
}

interface GeneratedReport {
  filename: string;
  rows: CallRecord[];   // see monitoring/spec.md for CallRecord shape
}
```

## POST /api/agents/:id/reports/generate

Backs `ReportService.generateReport(request: ReportRequest): Observable<GeneratedReport>`.

**Auth required:** Yes.
**Request body:** `ReportRequest` minus `agentId` (it's in the path instead — the mock's method signature carries it in the body since there's no real routing layer, but a REST path param is the more natural real shape).

**Response 200:**
```json
{ "filename": "string", "rows": [ /* CallRecord[] */ ] }
```

### Business rule: date-range computation (currently client-side — move server-side)

- `daily` → today only (last 1 day, from midnight to now).
- `weekly` → trailing 7 days.
- `monthly` → trailing 30 days.
- `custom` → exactly `[startDate 00:00:00, endDate 23:59:59.999]`, inclusive.

A row is included if `CallRecord.occurred_at` falls within the computed range (see `monitoring/spec.md` for the underlying data). Zero matching rows is a valid, non-error response — return `{ filename, rows: [] }`, and let the frontend show its existing "No leads in this period" state.

### Business rule / open decision: CSV vs. real `.xlsx`

The frontend generates a **CSV** client-side today (`toCsv()` in `report.service.ts` — a plain comma-joined string, downloaded via a `Blob` + anchor click). This was a deliberate mock-phase choice specifically to avoid pulling in a binary spreadsheet-writing library (e.g. SheetJS `xlsx`) purely for a client-side bundle-size reason — a real backend has no such constraint. `requirements/Main_Flow.txt` item 14 literally says "generated as an excel," so:

- **Recommended:** the backend generates a real `.xlsx` binary (any server-side library is fine — bundle size is not a concern here) and returns it, or a link to it, instead of CSV. This is something the backend can straightforwardly do *better* than the mock, not just replicate it.
- If you do this, the response shape above changes (either return the binary directly with an appropriate `Content-Type`/`Content-Disposition`, or return a `{ filename, downloadUrl }` pointing at a generated file) — this is a real API design choice to make, not a mirror of the mock's `{ filename, rows }` shape.

## GET /api/agents/:id/reports/:reportId/download

**Not present in the mock** (the mock builds and downloads the CSV entirely client-side from the `rows` already in memory — there's no separate "download" round-trip). Add this if you go the `.xlsx`-file-on-the-server route above; omit it if you keep returning row data directly and let the frontend build the file client-side as it does today.

## POST /api/reports/send-email

Backs `ReportService.sendReportEmail(report: GeneratedReport): Observable<void>`.

**Request body:** the `GeneratedReport` (or a report/agent id reference, once you've decided the generate-response shape above) plus wherever the recipient email should come from — **not currently modeled anywhere**: the mock doesn't take a recipient parameter at all, it's a no-op. You need a real "agent owner's contact email" field somewhere (on the `Agent`? A separate account/profile record? Undecided — see below) before this can be a real send.

**Response 202** (accepted for async delivery) once wired to a real provider (SendGrid/SES/Postmark/etc. — undecided, pick based on your infra).

## POST /api/reports/send-whatsapp

Backs `ReportService.sendReportWhatsApp(report: GeneratedReport): Observable<void>`. Same shape and same "no recipient modeled yet" gap as email above. A real implementation needs a WhatsApp Business API provider (Twilio, Meta Cloud API, etc.) — undecided.

**Response 202** once wired to a real provider.

## GET /api/agents/:id/report-frequency

Backs `ReportService.getFrequencyPreference(agentId): Observable<ReportFrequency | null>`.

**Response 200:** `{ "frequency": "daily" | "weekly" | "monthly" | null }`

## PUT /api/agents/:id/report-frequency

Backs `ReportService.setFrequencyPreference(agentId, frequency): Observable<void>`.

**Request body:** `{ "frequency": "daily" | "weekly" | "monthly" }`
**Response 204.**

### Business rule: this preference does not execute anything — by design, for now

The frontend is explicit (in its UI copy: "Stored as a preference only — reports are not generated or sent automatically") that setting a frequency does **not** trigger any automation. Store the value; do not build a scheduler for it unless you get an explicit go-ahead — turning this into a real recurring job requires a job-scheduling decision (cron table, queue + worker, third-party scheduler) plus the email/WhatsApp recipient-modeling gap above, none of which exist yet. Building a scheduler against an undefined recipient would just produce reports nobody receives.

---

## Open decisions

- **Real `.xlsx` vs. CSV** — recommended to upgrade, see above; changes the generate-response shape.
- **Recipient modeling for email/WhatsApp delivery** — no field exists anywhere for "the agent owner's contact info." Needs a real decision on where that lives (on `Agent`? A separate customer/account profile?) before delivery can be real.
- **Email/WhatsApp provider selection** — infra decision, not a spec question.
- **Turning the frequency preference into a real schedule** — explicitly out of scope until asked for; requires the recipient-modeling decision above plus a job-scheduling choice.
