## 1. Environment

- [x] 1.1 Add `wsUrl: 'ws://localhost:3100/ws'` to `src/environments/environment.ts` and a production placeholder (`wss://…/ws`) to `src/environments/environment.prod.ts`, documenting that the audio_processor runs on a separate server from the REST API.

## 2. Core audio_processor client

- [x] 2.1 Add `src/app/core/audio-processor/audio-processor.types.ts`: `AudioProcessorStatus`, `AudioProcessorSetup`, `ClientMessage`, `ServerMessage`/`ModelTurnPart`, and the `MIC_SAMPLE_RATE` (16000), `PLAYBACK_SAMPLE_RATE` (24000), `DEFAULT_VOICE_NAME` ('Aoede') constants.
- [x] 2.2 Add `src/app/core/audio-processor/audio-processor-ws.service.ts` (`@Injectable()`, component-provided): connect to `environment.wsUrl`, send `setup` on open, `sendAudio`/`sendText`, `disconnect`, close on `ngOnDestroy`; parse frames into `status$`, `userText$`, `assistantText$`, `audioChunk$`, `turnStart$`, `turnComplete$`, `interrupted$`, `error$`.
- [x] 2.3 Add `src/app/core/audio-processor/pcm-capture.service.ts`: `getUserMedia` + `AudioContext({ sampleRate: 16000 })` + `ScriptProcessorNode`, Float32 → Int16 LE → base64 chunks to a callback; `stop()` releases mic/context.
- [x] 2.4 Add `src/app/core/audio-processor/pcm-playback.service.ts`: base64 → Int16 → Float32 at 24 kHz, gapless `nextPlayTime` scheduling, `stopImmediately()` for barge-in, `dispose()`.
- [x] 2.5 Add `src/app/core/audio-processor/agent-setup.ts`: `buildAgentSetup(agent)` mapping `prompt` → `systemInstruction`, assigned E.164 → `phoneNumber` (omitted when absent), voice default `Aoede`.

## 3. Web Call preview component

- [x] 3.1 Add `src/app/features/playground/web-call-preview/web-call-preview.component.{ts,html,css}` (`app-web-call-preview`, standalone, `providers: [AudioProcessorWsService, PcmCaptureService, PcmPlaybackService]`).
- [x] 3.2 Start Web Call: load agent via `AgentService.getAgent`, connect with `buildAgentSetup`; on `open`, begin mic capture streaming to `sendAudio`, set status `active`/`listening`.
- [x] 3.3 Handle lifecycle: `turnStart` (clear playback + caption, speaking), `assistantText`/`audioChunk` (append caption / enqueue audio), `interrupted` (stop playback, finalize caption, listening), `turnComplete` (finalize caption, listening, emit `(passed)` on first completed turn), `userText` (add customer message), `error` (toast).
- [x] 3.4 End Call / mic-denied / `agentId` change / destroy: stop capture, stop playback, disconnect; render conversation transcript, live caption, connection/speaking status, and success line.

## 4. Preview panel third tab

- [x] 4.1 In `preview-panel.component.ts`, extend `PreviewMode` to `'call' | 'chat' | 'web-call'` and import `WebCallPreviewComponent`.
- [x] 4.2 In `preview-panel.component.html`, add the **Web Call** tab button and render `<app-web-call-preview [agentId] (passed)>` for the `web-call` mode; Chat now uses `@else if`.

## 5. Chat preview migration

- [x] 5.1 Rewrite `chat-preview.component.ts` to inject `AudioProcessorWsService` (component-provided), load the agent, connect with `buildAgentSetup` on Start, `sendText` on Send.
- [x] 5.2 Source messages from the server: `userText$` → customer bubble + count; accumulated `assistantText$` committed on `turnComplete$` → agent bubble + count; keep the "one each way + End Chat → passed" gate; disconnect on End/destroy/`agentId` change.
- [x] 5.3 Simplify `chat-preview.component.html`: transcript renders message entries only (remove the tool-call `@switch` branch); drop the now-unused tool-call types/helpers.

## 6. Verification

- [x] 6.1 Run `ng build` and fix any compile/type errors.
- [x] 6.2 Confirm no linter errors in new/changed files.
- [ ] 6.3 Manually exercise against a running `audio_processor` (port 3100): open Web Call, grant mic, hear the greeting, speak and confirm barge-in interrupts playback, verify captions/transcript; open Chat, send a message, confirm the echoed user message and agent reply render (audio ignored).
