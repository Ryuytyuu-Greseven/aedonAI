## 1. Realtime event types and mock transport

- [x] 1.1 Create `src/app/core/realtime/realtime.types.ts` with the `RealtimeEvent` discriminated union (`call.started`, `call.message`, `call.ended`) and the `RealtimeCommand` union (`call.start`)
- [x] 1.2 Create `src/app/core/realtime/realtime-transport.ts` defining the `RealtimeTransport` interface (`connect()`, `events()`, `send()`)
- [x] 1.3 Create `src/app/core/realtime/mock-realtime-transport.ts` implementing `RealtimeTransport` with an in-memory `Subject`, simulating `call.started` → alternating `call.message` events → `call.ended` (`completed` or `failed` outcome) on `send({ type: 'call.start' })`
- [x] 1.4 Create `src/app/core/realtime/realtime.service.ts` (`providedIn: 'root'`) wrapping a `RealtimeTransport`, exposing `events$` (multiplexed) and `connectionStatus$`
- [x] 1.5 Wire up connection at app bootstrap (`app.config.ts`) via an app initializer that calls `RealtimeService` connect logic on startup
- [x] 1.6 Provide `MockRealtimeTransport` as the `RealtimeTransport` implementation in `app.config.ts`

## 2. Call-initiation API

- [x] 2.1 Remove `AgentService.previewCall(...)` and its mock transcript logic
- [x] 2.2 Add `AgentService.callCustomer(agentId: string, phone: { countryCode: string; number: string }): Observable<{ callId: string }>`, mocked in the same in-memory style as `createAgent`/`updateAgent`, and internally triggering the realtime mock via `RealtimeService`/transport `send()`

## 3. Phone number input

- [x] 3.1 Add a small fixed `COUNTRY_CODES` list (value + dial code + label) near `CURRENCIES` in `src/app/core/models/agent.model.ts` or a new `phone.model.ts`
- [x] 3.2 Add country-code `<select>` and mobile-number `<input>` side by side to the Playground editor preview section template, with basic validation (country selected, digits-only, plausible length)

## 4. Preview UI rework

- [x] 4.1 In `playground-editor.component.ts`, add `previewAvailable = computed(...)` gating on `agentId()` present and `status() === 'draft'`; gate the preview section template on it
- [x] 4.2 Remove `previewTranscript` signal and the old `preview()` implicit-save-then-mock-call logic
- [x] 4.3 Add call-state signals: `activeCallId`, `callStatus` (`idle` | `calling` | `in-progress` | `ended`), `previewMessages` (list of `{ speaker, text }`)
- [x] 4.4 Implement `startPreviewCall()`: validates phone form, calls `AgentService.callCustomer(...)`, stores `callId`, subscribes to `RealtimeService.events$` filtered by that `callId`
- [x] 4.5 On `call.message` events, append to `previewMessages`; render as chat bubbles (agent vs. customer) in the template, replacing the old static transcript block
- [x] 4.6 On `call.ended`, set `previewPassed` true only if `outcome === 'completed'`; keep existing `invalidatePreview()` wiring (form `valueChanges` / `tools` effect) unchanged so edits still invalidate a passed preview
- [x] 4.7 Update `goLive()` gating check to rely on the new `previewPassed` derivation (no functional change needed if the signal name/semantics are preserved, but verify against the new call-based flow)

## 5. Cleanup and verification

- [x] 5.1 Remove any now-unused mock transcript fixtures/strings from `agent.service.ts`
- [x] 5.2 Manually verify: save draft → preview section appears → invalid phone shows error → valid phone starts call → messages stream in as bubbles → call ends → Go Live becomes available → editing a field invalidates preview again
- [x] 5.3 Run `openspec sync` (via `/project:opsx-sync`) after implementation to merge the `agent-preview-call` delta and new `realtime-events` spec into `openspec/specs/`
