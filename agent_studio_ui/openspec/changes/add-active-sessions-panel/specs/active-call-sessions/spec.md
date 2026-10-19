## ADDED Requirements

### Requirement: List Active Sessions For An Agent
The system SHALL provide a way to retrieve the set of calls currently in progress for a given agent, distinct from historical `CallRecord`/`CallDetail` data, including at minimum: a session identifier, customer name/phone, call direction, and the time the call started.

#### Scenario: Agent with calls in progress
- **WHEN** an agent currently has one or more calls in progress
- **THEN** each in-progress call is returned as an active session with its customer identity, direction, and start time

#### Scenario: Agent with no calls in progress
- **WHEN** an agent has zero calls in progress
- **THEN** an empty set of active sessions is returned rather than an error

### Requirement: Active Session List Stays Current
The system SHALL refresh the active session list for an agent while it is being viewed, so sessions that start or end are reflected without requiring a manual reload.

#### Scenario: A new call starts while the list is open
- **WHEN** a new call to the agent begins while its active sessions are being viewed
- **THEN** that call appears in the active session list within the refresh interval, without the viewer reloading the page

#### Scenario: An active call ends while the list is open
- **WHEN** an in-progress call for the agent ends while its active sessions are being viewed
- **THEN** that call is removed from the active session list within the refresh interval

### Requirement: Join An Active Session
The system SHALL allow a monitoring user to trigger joining a specific active session with a single action.

#### Scenario: Triggering a join
- **WHEN** the user triggers "Join" on an active session
- **THEN** the system records the intent to join that specific session (by its session identifier) and gives the user visible confirmation that the join was triggered

#### Scenario: Join affordance only available while a session is active
- **WHEN** a session is no longer active (it has ended)
- **THEN** it is no longer listed and no join action can be triggered for it

### Requirement: View An Active Session's Live Conversation
The system SHALL allow a monitoring user to open a live, chronologically-ordered, chat-style view of an active session's conversation, distinguishing agent messages from customer messages, without leaving the Active Sessions view.

#### Scenario: Opening the live conversation
- **WHEN** the user triggers "View" on an active session
- **THEN** a live conversation view opens for that specific session, showing its messages so far in chronological order with agent and customer messages visually distinguished

#### Scenario: New messages appear while the conversation is open
- **WHEN** the agent and customer exchange further messages while the live conversation view is open
- **THEN** those new messages appear in the view within its refresh interval, without the viewer closing and reopening it

#### Scenario: No messages yet
- **WHEN** the user opens the live conversation view immediately after a call started, before any messages have occurred
- **THEN** a waiting state is shown instead of an empty message list

#### Scenario: Joining from the live conversation view
- **WHEN** the user triggers "Join" from within the live conversation view
- **THEN** the same join behavior as joining from the Active Sessions list is triggered, for that session
