# Capability: Agent Preview Chat

## Purpose

Agent Preview Chat lets a customer test their draft agent via a real typed conversation, as an alternative to the Call preview, before launching it live. A successful Chat preview satisfies the same "must preview before Go Live" gate as a Call preview, per the `playground` capability.

---

## Requirements

### Requirement: Chat Preview Session
The system SHALL provide a "Chat" sub-tab within the Playground editor's Preview tab, available under the same conditions as the Call sub-tab (agent already saved, `status: 'draft'`), where the tester exchanges real typed messages with a mocked agent.

#### Scenario: Starting a chat session
- **WHEN** the user opens the Chat sub-tab for a saved `draft` agent
- **THEN** a chat session begins and the agent sends an opening greeting message

#### Scenario: Sending a message
- **WHEN** the user types a message and sends it
- **THEN** the message appears in the transcript attributed to the customer, and a mocked agent reply appears shortly after

#### Scenario: Chat unavailable before any save
- **WHEN** the user has not yet saved the agent (no `id` assigned)
- **THEN** the Chat sub-tab's session UI is not available, consistent with the Call sub-tab

### Requirement: Inline Tool Execution Visibility
The system SHALL show, inline in the chat transcript at the point they occur, any tool ("operation") the mocked agent invokes while formulating a reply — including the tool name, its input, its output, and whether it succeeded or errored.

#### Scenario: Agent performs an operation
- **WHEN** a mocked agent reply involves invoking a tool
- **THEN** a tool-execution card appears in the transcript, before or alongside that reply, showing the tool name, input, output, and success/error status

#### Scenario: Reply without a tool call
- **WHEN** a mocked agent reply does not involve a tool
- **THEN** only the message appears, with no tool-execution card

### Requirement: End Chat Marks Preview Success
The system SHALL let the user explicitly end the chat session via an "End Chat" action, enabled once at least one customer message has been sent and at least one agent reply received. Ending under those conditions SHALL mark the Chat preview as successful for the current editing session.

#### Scenario: Ending after a real exchange
- **WHEN** the user has exchanged at least one message each way and clicks "End Chat"
- **THEN** the session ends and the Chat preview is marked successful

#### Scenario: End Chat unavailable before any exchange
- **WHEN** no customer message has been sent yet (or no agent reply received yet)
- **THEN** "End Chat" is disabled

#### Scenario: Chat preview does not fail
- **WHEN** the user ends a chat session that had at least one exchange
- **THEN** the session is always marked successful — chat has no failure outcome, unlike the Call preview's simulated telephony flakiness
