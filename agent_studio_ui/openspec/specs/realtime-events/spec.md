# Capability: Realtime Events

## Purpose

Realtime Events provides a single, global, always-on WebSocket-shaped connection for the whole app, multiplexing server-pushed events (such as a live call's conversation) as one typed event stream, so features that need server-pushed data share one connection instead of each opening their own.

---

## Requirements

### Requirement: Global Realtime Connection
The system SHALL establish a single, global, always-on realtime (WebSocket-shaped) connection when the application starts, independent of any specific feature or route, and SHALL maintain it for the lifetime of the application session.

#### Scenario: Connection established at startup
- **WHEN** the application finishes bootstrapping
- **THEN** the realtime connection begins connecting without requiring any feature to explicitly request it

#### Scenario: Connection persists across navigation
- **WHEN** the user navigates between different routes/features in the app
- **THEN** the same realtime connection remains active and is not torn down or re-established per route

### Requirement: Multiplexed Typed Event Stream
The system SHALL expose all realtime data as a single stream of discriminated, typed events (each event carrying a `type` field), such that multiple logical event categories can share the one connection. Consumers SHALL filter this stream for the event types and identifiers (e.g., a specific call's `callId`) relevant to them.

#### Scenario: Consuming a specific event type
- **WHEN** a feature subscribes to the event stream and filters for a specific `type` and correlating identifier
- **THEN** it receives only events matching that filter, in the order they were emitted

#### Scenario: Multiple event types coexist
- **WHEN** events of different `type` values are emitted on the connection
- **THEN** each consumer's filtered view is unaffected by event types it does not filter for

### Requirement: Reconnection Handling
The system SHALL detect when the realtime connection drops and SHALL attempt to reconnect automatically, exposing a connection status that distinguishes at least connecting, open, reconnecting, and closed states.

#### Scenario: Connection drops and recovers
- **WHEN** the realtime connection is lost unexpectedly
- **THEN** the system transitions to a "reconnecting" status and attempts to reestablish the connection without requiring a page reload

### Requirement: Mocked Transport With Real-Client-Shaped Interface
Since no real backend realtime endpoint exists yet, the system SHALL simulate the realtime connection and event delivery in-memory, behind the same public interface a real WebSocket-backed implementation would use, so that swapping in a real backend later does not require changing consumer code.

#### Scenario: Mocked call events simulate a live call
- **WHEN** a call is initiated for a given `callId`
- **THEN** the mocked transport emits a start event, followed by a sequence of message events alternating between agent and customer, followed by an end event, all correlated by that `callId`

#### Scenario: Mocked chat events simulate an interactive chat session
- **WHEN** a chat session is started for a given `sessionId` and the client sends messages on it
- **THEN** the mocked transport emits a started event, an opening agent greeting, and — for each client-sent message — a corresponding agent reply (optionally preceded by a tool-call event), all correlated by that `sessionId`, sharing the same connection call events use
