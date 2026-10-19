# Capability: Call Log Detail

## Purpose

Call Log Detail gives a customer a per-call view of an agent's conversations: a filterable, paginated table of every call, and an advanced detail modal showing the full conversation timeline, tool executions, AI reasoning, and token usage for a single call. It's reached from the Monitor Detail page's "Call Log" tab, per the `monitor-agents` capability.

---

## Requirements

### Requirement: Call Log Table
The system SHALL display a paginated table of every call record for an agent on the Monitor Detail "Call Log" tab, showing at minimum: timestamp, direction (inbound/outbound), outcome, duration, and total tokens consumed. The table SHALL be paginated (fixed page size) with previous/next controls.

#### Scenario: Viewing the call log for a busy agent
- **WHEN** the user opens the Call Log tab for an agent with more than one page of calls
- **THEN** the first page of calls is shown, newest first, with pagination controls to view additional pages

#### Scenario: Viewing the call log for an agent with no calls
- **WHEN** the user opens the Call Log tab for an agent with zero call records
- **THEN** an empty state is shown instead of a table

### Requirement: Call Log Filters
The system SHALL allow the user to filter the call log table by date range (from/to), direction (inbound/outbound/all), and outcome (all/specific outcome). Filters SHALL apply client-side to the agent's already-loaded call records and reset pagination to the first page when changed.

#### Scenario: Filtering by direction
- **WHEN** the user filters the call log to "Inbound" only
- **THEN** only inbound calls are shown in the table, and pagination reflects the filtered count

#### Scenario: Filtering by date range
- **WHEN** the user sets a date range filter
- **THEN** only calls with `occurred_at` within that range are shown

#### Scenario: Combining filters with no matches
- **WHEN** the user's combined filters match no calls
- **THEN** an empty state specific to filters (e.g. "No calls match these filters") is shown, distinct from the no-calls-at-all empty state

### Requirement: Call Detail Modal
The system SHALL open an advanced modal when a call log row is clicked, showing that call's full detail: a header strip with stat pills (duration, total tokens, direction, outcome) each with an explanatory tooltip, and a unified chronological timeline of the call.

#### Scenario: Opening a call's detail
- **WHEN** the user clicks a row in the call log table
- **THEN** a modal opens showing the header stat pills and the call's timeline, loaded on demand for that specific call

#### Scenario: Tooltip on a stat pill
- **WHEN** the user hovers the "Tokens" stat pill in the modal header
- **THEN** a tooltip explains the prompt/completion token split contributing to the total

### Requirement: Unified Conversation Timeline
The system SHALL render the call's timeline as a single chronologically-ordered sequence mixing customer messages, agent messages, and tool-execution events, in the order they occurred.

#### Scenario: Viewing message and tool events together
- **WHEN** the user views a call whose timeline includes both messages and tool executions
- **THEN** both are rendered in one scrollable timeline, ordered by their actual occurrence time, not grouped into separate sections

### Requirement: Tool Execution Detail
The system SHALL show, for each tool execution in the timeline, the tool name, its input parameters, its output/response, whether it succeeded or errored, and how long it took.

#### Scenario: Viewing a successful tool call
- **WHEN** the timeline includes a tool execution that succeeded
- **THEN** the tool's name, input, output, and duration are shown inline at the point it occurred

#### Scenario: Viewing a failed tool call
- **WHEN** the timeline includes a tool execution that errored
- **THEN** the tool execution is visually distinguished as failed, and its error output is shown

### Requirement: AI Reasoning Per Turn
The system SHALL allow the user to reveal the agent's reasoning for a given turn via a collapsible "Show AI reasoning" toggle under that agent message, collapsed by default. Turns without recorded reasoning SHALL NOT show the toggle.

#### Scenario: Revealing reasoning for a turn
- **WHEN** the user clicks "Show AI reasoning" under an agent message that has recorded reasoning
- **THEN** the reasoning text for that turn expands inline, and can be collapsed again

#### Scenario: Turn without reasoning
- **WHEN** an agent message has no recorded reasoning
- **THEN** no "Show AI reasoning" toggle is shown for that turn

### Requirement: Token Usage Reporting
The system SHALL report token usage per call as prompt tokens, completion tokens, and total tokens, consistent between the call log table's "Total tokens" column and the detail modal's token stat pill.

#### Scenario: Consistent token totals
- **WHEN** the user compares a call's "Total tokens" value in the table against the same call's token stat pill in the detail modal
- **THEN** the values match
