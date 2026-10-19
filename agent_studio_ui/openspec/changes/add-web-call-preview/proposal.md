## Why

Testing an agent by calling a real phone number is slow and painful in local/staging environments. The backend now runs a separate `audio_processor` voice service that speaks the same LLM/TTS pipeline over a WebSocket (`/ws`), where the browser plays the role Twilio plays for real calls: it streams microphone audio up and receives synthesized audio back, plus transcripts and turn-lifecycle signals. This lets a builder talk to their agent directly from the browser — no phone, no telephony provider — before going live. The same socket also accepts plain `text` messages, so the existing Chat preview can run against the real agent instead of the in-memory mock.

## What Changes

- Add a new **Web Call** preview mode (third sub-tab alongside Call and Chat) that captures microphone audio, streams it to the `audio_processor` WebSocket as LINEAR16 16 kHz base64 chunks, and plays back the agent's LINEAR16 24 kHz audio response, with live captions, barge-in (interrupt) handling, and Go Live gating.
- Introduce a browser-side `audio_processor` WebSocket client (connect/setup/send/receive) plus mic-capture (16 kHz) and audio-playback (24 kHz, interruptible) helpers under `src/app/core/audio-processor/`.
- Point the existing **Chat** preview at the same `audio_processor` WebSocket using its text path (`{ text: "..." }`), rendering `userContent`/`modelTurn` text and ignoring the synthesized audio parts. Tool-execution cards are dropped because the `audio_processor` stream does not emit them.
- Add a `wsUrl` environment setting (`ws://localhost:3100/ws` in dev; a separate deployed host in prod) since the voice service runs on a different server from the REST API.
- Out of scope: the phone **Call** preview keeps using the existing mock `RealtimeService`/`callCustomer` path unchanged; no authentication on `/ws` (the protocol defines none yet); no replacement of the global mock realtime connection.

## Capabilities

### New Capabilities
- `agent-preview-web-call`: browser-based voice preview over the `audio_processor` WebSocket — mic capture and streaming, audio playback, turn lifecycle and barge-in, live transcript/captions, and Go Live gating on a completed turn.

### Modified Capabilities
- `agent-preview-chat`: the Chat preview now runs against the real `audio_processor` WebSocket text path instead of the in-memory mock; user/agent messages come from the server (`userContent` echo and `modelTurn` captions), and inline tool-execution cards are removed (not emitted by the stream).

## Impact

- `src/environments/environment.ts`, `src/environments/environment.prod.ts` — new `wsUrl`.
- `src/app/core/audio-processor/` (new): `audio-processor.types.ts`, `audio-processor-ws.service.ts`, `pcm-capture.service.ts`, `pcm-playback.service.ts`, `agent-setup.ts`.
- `src/app/features/playground/web-call-preview/` (new): `web-call-preview.component.ts` / `.html` / `.css`.
- `src/app/features/playground/preview-panel/preview-panel.component.ts` / `.html` — third `web-call` mode/tab.
- `src/app/features/playground/chat-preview/chat-preview.component.ts` / `.html` — migrated to the `audio_processor` text path; tool-call rendering removed.
