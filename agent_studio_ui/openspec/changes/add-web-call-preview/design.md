# Design: Web Call Preview (audio_processor WebSocket)

## Context

The `audio_processor` voice service (documented in `websockets.md`) exposes a single WebSocket endpoint `/ws` on a **separate** server (`localhost:3100` in dev; a different deployed host in prod — not behind the REST API's reverse proxy). It is JSON-over-WebSocket:

- **Client → server**: `{ setup }` (once, after connect), `{ realtimeInput: { audio: { data } } }` (base64 LINEAR16 mono 16 kHz mic chunks), `{ text }` (typed message).
- **Server → client**: `{ error }`, `{ userContent: { text } }` (user transcript / echo of typed text), and `{ serverContent: { turnStart | modelTurn | turnComplete | interrupted } }`. `modelTurn.parts[]` carry `inlineData` (base64 LINEAR16 mono **24 kHz** audio) and/or `text` captions.

This is deliberately **not** the existing global mock `RealtimeService` (a text-only, in-memory transcript simulator for the phone Call preview). Overloading that discriminated-union stream with binary audio would distort a socket designed for control events, so the audio_processor client is a separate, per-session connection.

## Goals / Non-Goals

- Goal: a browser voice preview (mic in, agent voice out) and a real-backed text chat, both over `/ws`.
- Non-goal: changing the phone Call preview, adding `/ws` auth, or migrating the global mock realtime connection.

## Decisions

### 1. Separate client, per-session, component-provided
`AudioProcessorWsService` manages one WebSocket session and is listed in each preview component's `providers` (not `providedIn: 'root'`), so Web Call and Chat each own an independent connection whose lifetime matches the component. The service closes the socket on `ngOnDestroy`, on `agentId` change, and on explicit end. This mirrors the doc's "connect → setup → use → close" model and avoids a global always-on voice socket.

### 2. RxJS Subjects per signal, not a single union stream
The service parses each server frame and emits on purpose-built subjects: `status$`, `userText$`, `assistantText$`, `audioChunk$`, `turnStart$`, `turnComplete$`, `interrupted$`, `error$`. Components subscribe only to what they need — Web Call uses audio + captions + lifecycle; Chat ignores `audioChunk$`. This keeps consumers simple and makes the "chat ignores audio" behavior a matter of not subscribing.

### 3. Audio format constants pinned to the protocol
Mic capture is fixed at 16 kHz (`MIC_SAMPLE_RATE`) and playback at 24 kHz (`PLAYBACK_SAMPLE_RATE`) per websockets.md. `PcmCaptureService` uses a `ScriptProcessorNode` (broad support, matches the guide) to convert Float32 → Int16 LE → base64. `PcmPlaybackService` decodes base64 → Int16 → Float32, schedules buffers back-to-back via `nextPlayTime`, and exposes `stopImmediately()` for barge-in.

### 4. Barge-in and turn lifecycle
On `turnStart`: clear any queued playback and reset the caption buffer (clean slate for the new turn). On `modelTurn`: enqueue audio and append caption text. On `interrupted`: stop playback immediately, finalize the partial caption, return to listening — do **not** wait for `turnComplete` (the server won't send one). On `turnComplete`: finalize the caption into an agent message and return to listening.

### 5. Setup mapping from the agent
`buildAgentSetup(agent)` maps a Playground `Agent` to the `setup` payload: `systemInstruction.parts[0].text` ← `agent.prompt` (when present), `phoneNumber` ← E.164 (`country_code + phone_number`) when the agent has a number assigned (routing it to the matching business the same way an inbound Twilio call would), otherwise omitted so the server falls back to its default business. Voice defaults to `Aoede`. Both Web Call and Chat load the agent via `AgentService.getAgent(id)` before connecting so the setup reflects the saved configuration.

### 6. Go Live gating
Web Call emits `(passed)` after the first `turnComplete` (a real agent turn occurred), feeding the existing `PreviewPanel (passed) → onPreviewPassed()` gate exactly like Call/Chat. Chat keeps its existing "at least one message each way, then End Chat" rule, now driven by server `userContent` (customer count) and finalized `turnComplete` captions (agent count).

### 7. Chat message sourcing to avoid duplicates
Because the server echoes typed text back as `userContent`, Chat does **not** optimistically add the customer bubble on send; it renders the echoed `userContent` instead, keeping a single source of truth and matching how voice transcripts arrive. Agent replies are the accumulated `modelTurn` caption text, committed on `turnComplete`.

## Risks / Trade-offs

- `ScriptProcessorNode` is deprecated; acceptable for a preview tool and matches the reference guide. An `AudioWorklet` migration can follow without changing the service boundary.
- No `/ws` auth yet: if the backend later requires a token, it can be added to the `wsUrl` query or the first message without touching consumers.
- `phoneNumber`-based routing depends on the backend's (currently mocked) number→business directory; when no number is assigned the server default applies, which is acceptable for preview.
