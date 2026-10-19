## MODIFIED Requirements

### Requirement: Mocked Transport With Real-Client-Shaped Interface
Since no real backend realtime endpoint exists yet, the system SHALL simulate the realtime connection and event delivery in-memory, behind the same public interface a real WebSocket-backed implementation would use, so that swapping in a real backend later does not require changing consumer code.

#### Scenario: Mocked call events simulate a live call
- **WHEN** a call is initiated for a given `callId`
- **THEN** the mocked transport emits a start event, followed by a sequence of message events alternating between agent and customer, followed by an end event, all correlated by that `callId`

#### Scenario: Mocked chat events simulate an interactive chat session
- **WHEN** a chat session is started for a given `sessionId` and the client sends messages on it
- **THEN** the mocked transport emits a started event, an opening agent greeting, and — for each client-sent message — a corresponding agent reply (optionally preceded by a tool-call event), all correlated by that `sessionId`, sharing the same connection call events use
