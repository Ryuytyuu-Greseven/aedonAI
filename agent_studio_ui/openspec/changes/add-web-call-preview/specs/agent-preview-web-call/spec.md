## ADDED Requirements

### Requirement: Web Call Preview Session
The system SHALL provide a "Web Call" sub-tab within the Playground editor's Preview tab, alongside the "Call" and "Chat" sub-tabs, available under the same conditions as those sub-tabs (agent already saved). Starting a Web Call SHALL open a WebSocket connection to the `audio_processor` voice service (`environment.wsUrl`, a server separate from the REST API) and send a `setup` message derived from the saved agent, after which the server begins the agent's spoken greeting.

#### Scenario: Starting a web call
- **WHEN** the user opens the Web Call sub-tab for a saved agent and clicks "Start Web Call"
- **THEN** the app connects to the audio_processor WebSocket, sends `setup` for that agent, and the agent's greeting begins playing

#### Scenario: Web call unavailable before any save
- **WHEN** the user has not yet saved the agent (no `id` assigned)
- **THEN** the Web Call session UI is not available, consistent with the Call and Chat sub-tabs

#### Scenario: Setup routing from the agent
- **WHEN** a Web Call session is set up for an agent that has a phone number assigned
- **THEN** the agent's E.164 number is sent as `phoneNumber` for business routing, and the agent's behavior prompt is sent as `systemInstruction`
- **AND WHEN** the agent has no phone number assigned, `phoneNumber` is omitted and the server's default business applies

### Requirement: Microphone Streaming
The system SHALL, while a Web Call session is active, capture microphone audio as LINEAR16 (signed 16-bit little-endian) mono at 16 kHz and continuously stream it to the server as base64-encoded chunks in `realtimeInput.audio.data`.

#### Scenario: Streaming mic audio
- **WHEN** a Web Call session is active and the user speaks
- **THEN** the browser sends the microphone audio to the server as base64 LINEAR16 16 kHz chunks

#### Scenario: Microphone permission denied
- **WHEN** the user denies microphone access after starting a Web Call
- **THEN** the app shows an error, stops the session, and does not remain in an active call state

### Requirement: Agent Audio Playback
The system SHALL decode the base64 LINEAR16 mono 24 kHz audio parts of each `serverContent.modelTurn` and play them back through the Web Audio API, scheduling chunks sequentially for gapless playback, and SHALL display any accompanying caption `text` parts as the agent's live response.

#### Scenario: Playing the agent response
- **WHEN** the server sends `modelTurn` parts containing audio and/or caption text
- **THEN** the app plays the 24 kHz audio in order and shows the caption text as the agent speaks

### Requirement: Turn Lifecycle and Barge-In
The system SHALL track the turn lifecycle: on `turnStart` prepare a clean playback/caption state and mark the agent as speaking; on `turnComplete` finalize the agent's message and return to listening; and on `interrupted` stop playback immediately, clear the queued audio, finalize the partial caption, and return to listening without waiting for `turnComplete`.

#### Scenario: User interrupts the agent
- **WHEN** the server sends `interrupted` while agent audio is playing
- **THEN** the app stops playback immediately, clears any queued audio, and returns to the listening state

#### Scenario: Agent finishes a turn normally
- **WHEN** the server sends `turnComplete`
- **THEN** the app lets the queued audio finish, finalizes the agent's message in the transcript, and returns to listening

### Requirement: Web Call Preview Gates Go Live
The system SHALL mark the Web Call preview as successful once at least one agent turn has completed (`turnComplete`) in the session, satisfying the same "must preview before Go Live" gate as the Call and Chat previews.

#### Scenario: Completing a web call turn
- **WHEN** the agent completes at least one turn during a Web Call session
- **THEN** the Web Call preview is marked successful for the current editing session

### Requirement: Ending a Web Call
The system SHALL let the user end the Web Call at any time, and SHALL also tear down the session (stop microphone capture, stop playback, and close the WebSocket) when the previewed agent changes or the component is destroyed.

#### Scenario: User ends the web call
- **WHEN** the user clicks "End Call"
- **THEN** microphone capture and audio playback stop and the WebSocket connection is closed

#### Scenario: Session torn down on teardown
- **WHEN** the previewed agent changes or the Preview panel is destroyed during an active Web Call
- **THEN** microphone capture and playback stop and the WebSocket is closed
