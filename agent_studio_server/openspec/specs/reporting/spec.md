# Capability: Reporting

## Purpose

Period-based report generation and download of an agent's call/lead data, plus a stored (non-executing) frequency preference. Backs `ReportService`. Implemented per `../builder_config/backend-openspec/specs/reporting/spec.md`, with the CSV-vs-`.xlsx` open decision resolved in favor of real `.xlsx` (per the original product requirement's literal "generated as an excel").

---

## Requirements

### Requirement: Report Generation
The system SHALL compute a report's date range server-side from a `period`, and return the matching call records plus a stateless `reportId` that can be exchanged for a real `.xlsx` file.

#### Scenario: Daily period
- **WHEN** `POST /api/agents/:id/reports/generate { period: "daily" }` is called
- **THEN** the system returns rows with `occurred_at` between today's midnight and now

#### Scenario: Weekly / monthly period
- **WHEN** `period` is `"weekly"` or `"monthly"`
- **THEN** the system returns rows from the trailing 7 or 30 calendar days (inclusive of today) through now

#### Scenario: Custom period
- **WHEN** `period` is `"custom"` with `startDate`/`endDate`
- **THEN** the system returns rows with `occurred_at` in `[startDate 00:00:00.000, endDate 23:59:59.999]` inclusive

#### Scenario: Missing custom range
- **WHEN** `period` is `"custom"` without both `startDate` and `endDate`
- **THEN** the system rejects with `400`

#### Scenario: No matching rows
- **WHEN** a report's computed range matches zero call records
- **THEN** the system returns `200 { reportId, filename, rows: [] }`, not an error

### Requirement: Real Excel Download
The system SHALL generate an actual `.xlsx` binary (not CSV) on demand for a given `reportId`, recomputed statelessly rather than persisted as a file on disk.

#### Scenario: Downloading a report
- **WHEN** `GET /api/agents/:id/reports/:reportId/download` is called with a `reportId` returned from a prior `generate` call
- **THEN** the system streams an `.xlsx` file with the same rows, with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Requirement: Report Frequency Preference
The system SHALL store a per-agent frequency preference that does not trigger any automation — no scheduler exists.

#### Scenario: Setting a preference
- **WHEN** `PUT /api/agents/:id/report-frequency { frequency: "weekly" }` is called
- **THEN** the system stores the preference and returns `204`; no report is generated or sent as a result

#### Scenario: Reading an unset preference
- **WHEN** `GET /api/agents/:id/report-frequency` is called for an agent with no stored preference
- **THEN** the system returns `200 { frequency: null }`

### Requirement: Email / WhatsApp Delivery Stubs
The system SHALL accept a delivery request with an explicit recipient and acknowledge it, without actually sending anything, since no provider has been selected.

#### Scenario: Requesting email delivery
- **WHEN** `POST /api/reports/send-email { recipient, filename }` is called with a valid email
- **THEN** the system returns `202` and logs the request; no email is actually sent

#### Scenario: Requesting WhatsApp delivery
- **WHEN** `POST /api/reports/send-whatsapp { recipient, filename }` is called
- **THEN** the system returns `202` and logs the request; no message is actually sent

---

## Open decisions (unchanged/updated from backend-openspec)

- Email/WhatsApp provider selection (SendGrid/SES/Postmark; Twilio/Meta Cloud API) — not chosen; stub endpoints only.
- Recipient modeling: resolved for now by accepting `recipient` directly in the send request rather than adding a speculative contact field on `Agent` — revisit if a persistent "agent owner contact" concept is introduced.
- Turning the frequency preference into a real schedule — explicitly out of scope until requested.
