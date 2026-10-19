# Capability: Reporting

## Purpose

Reporting lets a customer generate a downloadable file of an agent's call leads for a chosen period, and mock-deliver it by email or WhatsApp, from within the Monitor Agents detail view. A per-agent frequency preference can be stored, but nothing is auto-generated or auto-sent — every report is triggered manually.

---

## Requirements

### Requirement: Report Period Selection
The system SHALL let the user select a report period of Daily, Weekly, Monthly, or Custom (explicit start/end date) within an agent's Monitor Agents detail view.

#### Scenario: Selecting a preset period
- **WHEN** the user selects "Weekly"
- **THEN** the report date range is computed as the trailing 7 days from today

#### Scenario: Selecting a custom period
- **WHEN** the user selects "Custom" and enters a start and end date
- **THEN** the report date range uses exactly those dates

### Requirement: Generate Report
The system SHALL generate a downloadable report file containing that agent's call leads (id, direction, timestamp, outcome) within the selected period, via a mock API call.

#### Scenario: Generating a report with leads in range
- **WHEN** the user clicks "Generate Report" for a period containing call records
- **THEN** a mock API call returns a file containing one row per call record in that period, available to download

#### Scenario: Generating a report with no leads in range
- **WHEN** the user clicks "Generate Report" for a period with no matching call records
- **THEN** a file with just the header row (or an explicit "no leads in this period" state) is produced, not an error

### Requirement: Download Report
The system SHALL let the user download the generated report file directly from the browser.

#### Scenario: Downloading a generated report
- **WHEN** the user clicks "Download" after generating a report
- **THEN** the file downloads via the browser with a name identifying the agent and period

### Requirement: Mock Email and WhatsApp Delivery
The system SHALL provide "Send via Email" and "Send via WhatsApp" actions on a generated report, each performing a mock API call and confirming with a toast; no real message is sent.

#### Scenario: Sending via email
- **WHEN** the user clicks "Send via Email" on a generated report
- **THEN** a mock API call simulates delivery and a success toast confirms it

#### Scenario: Sending via WhatsApp
- **WHEN** the user clicks "Send via WhatsApp" on a generated report
- **THEN** a mock API call simulates delivery and a success toast confirms it

### Requirement: Report Frequency Preference
The system SHALL let the user set a preferred report frequency (Daily, Weekly, or Monthly) per agent, persisted via a mock API call. This preference is stored only — the system SHALL NOT imply or perform automatic scheduled generation or delivery.

#### Scenario: Setting a frequency preference
- **WHEN** the user selects a preferred frequency and saves
- **THEN** the preference is persisted via a mock API call and shown as the current setting on next load

#### Scenario: Preference does not trigger automation
- **WHEN** a frequency preference is set
- **THEN** no report is automatically generated or delivered; "Generate Report" remains a manual action
