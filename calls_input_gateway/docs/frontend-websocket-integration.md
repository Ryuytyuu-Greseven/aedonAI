# Frontend WebSocket Integration Guide

This document describes how to connect a browser frontend to the **audio_processor** voice assistant over WebSocket (`/ws`). Use it as a reference when implementing real-time voice chat, playback, and barge-in (interrupt) handling.

---

## Connection

```
wss://<your-server-host>/ws
```

On connect, the server initializes a session automatically. No handshake message is required before setup.

---

## Message overview

| Direction | Purpose |
|-----------|---------|
| Client → Server | Session setup, microphone audio |
| Server → Client | AI audio stream, transcripts, turn lifecycle signals |

All messages are JSON strings sent over the WebSocket.

---

## Client → Server messages

### 1. Setup (send once after connect)

Configures the agent and triggers the initial greeting.

```json
{
  "setup": {
    "model": "models/gemini-3.1-flash-lite",
    "business": "sales",
    "generationConfig": {
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Aoede"
          }
        }
      }
    },
    "systemInstruction": {
      "parts": [
        { "text": "You are a helpful voice assistant." }
      ]
    }
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `business` | Yes | Routes to the correct domain agent (`sales`, `hiring`, `lobster_agent`, etc.) |
| `generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | No | TTS voice name (default: `Aoede`) |
| `systemInstruction.parts[0].text` | No | System prompt for the agent |
| `model` | No | Model identifier (mostly used for config parsing) |

After setup, the server immediately starts the greeting (`SYSTEM_START_CONVERSATION`).

---

### 2. Microphone audio (send continuously while user may speak)

Send base64-encoded **LINEAR16 PCM, mono, 16 kHz** audio chunks.

```json
{
  "realtimeInput": {
    "audio": {
      "data": "<base64-encoded-pcm-chunk>"
    }
  }
}
```

Keep streaming mic audio for the entire session. The server uses it for speech-to-text and barge-in detection (interrupting the AI when the user starts talking).

---

## Server → Client messages

Every server payload is a top-level JSON object. Handle these shapes:

### Error

```json
{ "error": "Service down" }
```

or

```json
{ "error": "Processing error: ..." }
```

Close or show an error UI when received.

---

### User transcript

Sent when the server finishes transcribing what the user said.

```json
{
  "userContent": {
    "text": "What are your business hours?"
  }
}
```

**Frontend action:** Append a user message bubble in the chat UI.

---

### Turn lifecycle signals (`serverContent`)

These control when the AI is speaking and when playback should start or stop.

#### `turnStart` — AI is about to respond

```json
{
  "serverContent": {
    "turnStart": true
  }
}
```

**Frontend action:**
- Mark the assistant as "speaking" / loading
- Prepare the audio playback queue for a new turn
- Optionally reset the caption buffer for this turn

---

#### `modelTurn` — streaming audio and/or caption text

```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        {
          "inlineData": {
            "mimeType": "audio/l16",
            "data": "<base64-encoded-pcm>"
          }
        },
        {
          "text": "Our hours are nine to five. "
        }
      ]
    }
  }
}
```

A single message may contain:
- **Audio only** — `inlineData` part
- **Text only** — caption/transcript chunk (arrives slightly before or with audio)
- **Both** — less common, but handle either part independently

**Audio format:**
| Property | Value |
|----------|-------|
| Encoding | LINEAR16 (signed 16-bit little-endian PCM) |
| Sample rate | 24,000 Hz |
| Channels | 1 (mono) |
| Transport | Base64 string in `inlineData.data` |

**Frontend action:**
- Decode base64 → `ArrayBuffer` / `Int16Array`
- Queue and play through Web Audio API (or your audio player)
- Append `text` parts to the live assistant caption

---

#### `turnComplete` — AI finished speaking normally

```json
{
  "serverContent": {
    "turnComplete": true
  }
}
```

**Frontend action:**
- Mark the assistant turn as done (after queued audio finishes playing)
- Allow the UI to show "listening" again
- Finalize the assistant message in chat

> **Note:** `turnComplete` is **not** sent when the user interrupts. Only `interrupted` is sent in that case.

---

#### `interrupted` — user barged in; stop playback immediately

```json
{
  "serverContent": {
    "interrupted": true
  }
}
```

Sent when the user starts speaking while the AI is still talking. The server stops generating new audio, but the frontend must also stop anything already queued or playing.

**Frontend action (required):**
1. **Stop playback immediately** — suspend/clear `AudioContext` scheduled buffers
2. **Clear the audio queue** — discard all pending PCM chunks for the current turn
3. **Reset speaking state** — do not wait for `turnComplete`
4. Optionally truncate the assistant caption with an interrupted indicator

This is the most important signal for real-time conversation feel.

---

## Turn state machine

Use this mental model on the frontend:

```
[idle / listening]
    │
    │  user speaks → server sends userContent
    │
    ▼
[waiting for AI]
    │
    │  server sends turnStart
    ▼
[assistant speaking]
    │
    ├── modelTurn (audio + text) × N
    │
    ├──► interrupted ──► [stop playback] ──► [listening]
    │
    └──► turnComplete ──► [finish playback queue] ──► [listening]
```

---

## Recommended frontend architecture

### 1. WebSocket handler

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.error) {
    handleError(msg.error);
    return;
  }

  if (msg.userContent?.text) {
    addUserMessage(msg.userContent.text);
    return;
  }

  const sc = msg.serverContent;
  if (!sc) return;

  if (sc.turnStart) {
    onTurnStart();
    return;
  }

  if (sc.interrupted) {
    onInterrupted();
    return;
  }

  if (sc.turnComplete) {
    onTurnComplete();
    return;
  }

  if (sc.modelTurn?.parts) {
    for (const part of sc.modelTurn.parts) {
      if (part.inlineData?.data) {
        enqueueAudio(part.inlineData.data);
      }
      if (part.text) {
        appendAssistantCaption(part.text);
      }
    }
  }
};
```

### 2. Audio playback helper (Web Audio API sketch)

```typescript
const SAMPLE_RATE = 24000;
let audioContext: AudioContext;
let nextPlayTime = 0;
let scheduledSources: AudioBufferSourceNode[] = [];

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function enqueueAudio(base64Pcm: string) {
  if (!audioContext) audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

  const int16 = base64ToInt16Array(base64Pcm);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

  const buffer = audioContext.createBuffer(1, float32.length, SAMPLE_RATE);
  buffer.copyToChannel(float32, 0);

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);

  const now = audioContext.currentTime;
  if (nextPlayTime < now) nextPlayTime = now;
  source.start(nextPlayTime);
  nextPlayTime += buffer.duration;

  scheduledSources.push(source);
  source.onended = () => {
    scheduledSources = scheduledSources.filter((s) => s !== source);
  };
}

function stopPlaybackImmediately() {
  for (const source of scheduledSources) {
    try { source.stop(); } catch { /* already stopped */ }
  }
  scheduledSources = [];
  nextPlayTime = 0;
}
```

### 3. Interrupt handler

```typescript
function onInterrupted() {
  stopPlaybackImmediately();
  setAssistantState('listening');
  // Optional: mark current caption as interrupted
}

function onTurnStart() {
  stopPlaybackImmediately(); // clean slate for new turn
  setAssistantState('speaking');
  clearAssistantCaption();
}

function onTurnComplete() {
  setAssistantState('listening');
  finalizeAssistantMessage();
}
```

---

## Sending microphone audio from the browser

Capture mic at **16 kHz mono LINEAR16** to match what the server expects:

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext({ sampleRate: 16000 });
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (e) => {
  const float32 = e.inputBuffer.getChannelData(0);
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
  ws.send(JSON.stringify({ realtimeInput: { audio: { data: base64 } } }));
};

source.connect(processor);
processor.connect(audioContext.destination);
```

> Prefer `AudioWorklet` over `ScriptProcessor` in production — the above is a minimal example.

---

## Full conversation flow (example)

```
1. Client connects to wss://host/ws
2. Client sends { setup: { ... } }
3. Server sends { serverContent: { turnStart: true } }           ← greeting begins
4. Server sends { serverContent: { modelTurn: { parts: [...] } } }  ← audio chunks
5. Server sends { serverContent: { turnComplete: true } }        ← greeting done

--- user speaks ---

6. Server sends { serverContent: { interrupted: true } }           ← if user talked over AI
7. Server sends { userContent: { text: "..." } }                  ← user's words

8. Server sends { serverContent: { turnStart: true } }           ← AI response begins
9. Server sends { serverContent: { modelTurn: { parts: [...] } } }
10. Server sends { serverContent: { turnComplete: true } }
```

---

## Implementation checklist

Use this when building or reviewing the frontend:

- [ ] Connect to `/ws` and send `setup` on open
- [ ] Stream mic audio as `realtimeInput.audio.data` (LINEAR16, 16 kHz, base64)
- [ ] Handle `userContent.text` → show user message
- [ ] Handle `serverContent.turnStart` → prepare new playback turn
- [ ] Handle `serverContent.modelTurn.parts` → play `audio/l16` at 24 kHz, show captions
- [ ] Handle `serverContent.interrupted` → **stop playback and clear queue immediately**
- [ ] Handle `serverContent.turnComplete` → finalize turn (only on normal completion)
- [ ] Handle `error` → show error / reconnect
- [ ] Do not expect `turnComplete` after `interrupted`

---

## Common pitfalls

| Problem | Cause | Fix |
|---------|-------|-----|
| AI keeps talking after user speaks | Frontend ignores `interrupted` | Call `stopPlaybackImmediately()` on `interrupted` |
| No audio heard | Wrong sample rate (using 16 kHz for playback) | Playback is **24 kHz**; mic input is **16 kHz** |
| Audio cuts off early | Not draining the playback queue before `turnComplete` | `turnComplete` means server is done sending; let queued audio finish |
| Greeting never plays | Setup not sent | Send `setup` right after WebSocket `open` |
| Choppy playback | Not scheduling sequential chunks | Use `nextPlayTime` scheduling (see example above) |

---

## Backend reference

| File | Role |
|------|------|
| `src/assistant/gateways/assistant.gateway.ts` | WebSocket endpoint `/ws` |
| `src/assistant/services/assistant.service.ts` | Turn lifecycle, `interrupted`, `turnStart`, `turnComplete` |
| `src/assistant/services/gemini.service.ts` | TTS streaming (`audio/l16`, 24 kHz) |

For Twilio phone calls, the same assistant pipeline runs through a protocol adapter — browser clients talk to `/ws` directly with the messages described above.
