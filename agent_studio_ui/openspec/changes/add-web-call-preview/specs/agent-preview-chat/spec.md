## MODIFIED Requirements

### Requirement: Chat Preview Session
The system SHALL provide a "Chat" sub-tab within the Playground editor's Preview tab, available under the same conditions as the Call sub-tab (agent already saved), where the tester exchanges real typed messages with the agent over the `audio_processor` WebSocket (`environment.wsUrl`) using its text path. Starting a chat session SHALL open the connection and send a `setup` message derived from the saved agent; the tester's messages SHALL be sent as `{ text }`, and the transcript SHALL be populated from the server's `userContent` (the echoed/transcribed user message) and the accumulated caption `text` of each `modelTurn`. The synthesized audio parts of `modelTurn` SHALL be ignored for the text chat UI.

#### Scenario: Starting a chat session
- **WHEN** the user opens the Chat sub-tab for a saved agent and starts the session
- **THEN** the app connects to the audio_processor WebSocket, sends `setup` for that agent, and the agent sends an opening greeting message rendered as caption text

#### Scenario: Sending a message
- **WHEN** the user types a message and sends it
- **THEN** the app sends it as a `text` message, the server echoes it back as `userContent` (rendered attributed to the customer), and the agent's reply caption appears shortly after

#### Scenario: Agent audio ignored in text chat
- **WHEN** the server includes audio (`inlineData`) parts in a `modelTurn` alongside caption text
- **THEN** the Chat UI renders only the caption text and does not play the audio

#### Scenario: Chat unavailable before any save
- **WHEN** the user has not yet saved the agent (no `id` assigned)
- **THEN** the Chat sub-tab's session UI is not available, consistent with the Call sub-tab

### Requirement: End Chat Marks Preview Success
The system SHALL let the user explicitly end the chat session via an "End Chat" action, enabled once at least one customer message has been received back from the server (`userContent`) and at least one agent reply (a completed `modelTurn` caption) has been received. Ending under those conditions SHALL mark the Chat preview as successful for the current editing session and close the WebSocket connection.

#### Scenario: Ending after a real exchange
- **WHEN** the user has exchanged at least one message each way and clicks "End Chat"
- **THEN** the session ends, the WebSocket is closed, and the Chat preview is marked successful

#### Scenario: End Chat unavailable before any exchange
- **WHEN** no customer message has been echoed yet (or no agent reply received yet)
- **THEN** "End Chat" is disabled

#### Scenario: Chat preview does not fail
- **WHEN** the user ends a chat session that had at least one exchange
- **THEN** the session is always marked successful — chat has no failure outcome, unlike the Call preview's simulated telephony flakiness

## REMOVED Requirements

### Requirement: Inline Tool Execution Visibility
**Reason**: The `audio_processor` WebSocket stream does not emit tool-execution events, so the Chat preview can no longer render inline tool-execution cards. This capability was tied to the in-memory mock realtime stream that the Chat preview no longer uses.
**Migration**: None. Tool-execution visibility during preview is dropped; the transcript renders user and agent messages only.
