## MODIFIED Requirements

### Requirement: Preview Draft Agent
The system SHALL provide a "Preview" section on a `draft` agent that is only shown once the agent has already been saved (i.e., has an `id` and `status: 'draft'`). The Preview section SHALL collect a customer's country code and mobile number via two side-by-side inputs, then SHALL initiate a (mocked) outbound call to that number via a backend API call, returning a `callId`. The live conversation between the agent and the customer SHALL be streamed from the backend over the `realtime-events` WebSocket connection and rendered incrementally as chat messages (agent vs. customer) as they arrive, until the call ends.

#### Scenario: Preview unavailable before any save
- **WHEN** the user has not yet saved the agent (no `id` assigned)
- **THEN** the Preview section is not shown

#### Scenario: Preview available after a successful save
- **WHEN** the agent has been saved and has `status: 'draft'`
- **THEN** the Preview section is shown, presenting a country-code selector and a mobile-number input side by side

#### Scenario: Submitting an invalid phone number
- **WHEN** the user submits the call form without selecting a country code, or with a mobile number that is empty or not a plausible number of digits
- **THEN** the system shows a validation error and does not initiate a call

#### Scenario: Starting a call
- **WHEN** the user submits a valid country code and mobile number
- **THEN** the system calls the (mocked) backend API to initiate an outbound call, receives a `callId`, and begins listening for that call's events on the realtime connection

#### Scenario: Conversation streams in live
- **WHEN** the backend emits `call.message` events for the active `callId` over the realtime connection
- **THEN** each message is appended to the conversation view as a chat bubble, attributed to the agent or the customer, in the order received

#### Scenario: Call ends
- **WHEN** the backend emits a `call.ended` event for the active `callId`
- **THEN** the conversation view indicates the call has ended and no further messages are expected for that call

### Requirement: Preview Gates Go Live
The system SHALL only allow the "Go Live" action once a Preview call for the current `draft` agent has completed successfully (a `call.ended` event with outcome `completed`) in the current editing session. Any subsequent change to the agent's customization fields or export destinations SHALL invalidate the passed preview, requiring a new successful call before Go Live is reachable again.

#### Scenario: Go Live unavailable before a completed preview call
- **WHEN** the user opens a `draft` agent that has not had a successfully completed preview call in this session
- **THEN** the "Go Live" action is disabled or hidden

#### Scenario: Go Live available after a successfully completed preview call
- **WHEN** the active preview call ends with outcome `completed`
- **THEN** the "Go Live" action becomes available

#### Scenario: Go Live unavailable after a failed preview call
- **WHEN** the active preview call ends with outcome `failed`
- **THEN** the "Go Live" action remains disabled or hidden

#### Scenario: Editing after a successful preview invalidates it
- **WHEN** the user edits any field or export destination after a successful preview call
- **THEN** "Go Live" becomes unavailable again until a new preview call completes successfully
