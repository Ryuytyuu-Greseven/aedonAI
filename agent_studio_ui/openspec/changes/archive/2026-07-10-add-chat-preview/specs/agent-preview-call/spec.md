## MODIFIED Requirements

### Requirement: Preview Draft Agent
The system SHALL provide a "Call" sub-tab within the Playground editor's Preview tab, alongside the "Chat" sub-tab, shown only once the agent has already been saved (i.e., has an `id` and `status: 'draft'`). The Call sub-tab SHALL collect a customer's country code and mobile number via two side-by-side inputs, then SHALL initiate a (mocked) outbound call to that number via a backend API call, returning a `callId`. The live conversation between the agent and the customer SHALL be streamed from the backend over the `realtime-events` WebSocket connection and rendered incrementally as chat messages (agent vs. customer) as they arrive, until the call ends.

#### Scenario: Preview unavailable before any save
- **WHEN** the user has not yet saved the agent (no `id` assigned)
- **THEN** the Call sub-tab's call form is not shown

#### Scenario: Preview available after a successful save
- **WHEN** the agent has been saved and has `status: 'draft'`
- **THEN** the Call sub-tab shows a country-code selector and a mobile-number input side by side

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

## REMOVED Requirements

### Requirement: Preview Gates Go Live
**Reason**: Go Live's "must have a successful preview" gate is no longer specific to the Call preview — a successful Chat preview satisfies it too. This requirement's behavior moves to the `playground` capability, generalized to cover either preview mode.
**Migration**: See `playground`'s "Preview Gates Go Live" requirement, which covers the same call-outcome behavior plus the new chat-outcome case.
