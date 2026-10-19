## Context

Today `AgentService.previewCall(id)` (`src/app/core/services/agent.service.ts`) is a single mocked `Observable` that returns a canned transcript string after a 300ms delay. `PlaygroundEditorComponent.preview()` calls `persist()` then this method, and sets `previewPassed`/`previewTranscript` signals from the one-shot result. There is no HTTP client, no WebSocket, and no country/phone field anywhere in the app (confirmed by repo search) — every "backend" interaction today is an in-memory mocked `Observable`.

We now need to (a) collect a phone number, (b) start a call against that number, and (c) receive a stream of conversation turns over time as the call happens, then know when the call ends. A single request/response `Observable` cannot model "many events over an unbounded duration," so this requires a persistent, server-push channel — a WebSocket — modeled now, even though there's no real backend, so the eventual swap is additive rather than a rewrite.

## Goals / Non-Goals

**Goals:**
- Gate the Preview UI on `agentId() != null && status() === 'draft'` (i.e., already saved), removing the implicit first-save-on-preview behavior.
- Collect country code + mobile number via two side-by-side controls with basic client-side validation (non-empty digits, sane length).
- Model "call a customer" as an initiating action plus a stream of subsequent events, not a single request/response.
- Provide one global, always-connected event source for the whole app, not a one-off connection scoped to the Playground editor, so future features (e.g. live agent status, notifications) can reuse it without adding another connection.
- Keep the mock believable enough to drive real UI development (staggered message delivery, explicit call-ended event) without needing a backend.
- Make the eventual real-backend swap a matter of replacing the transport internals, not the public API or event shapes.

**Non-Goals:**
- Implementing a real WebSocket server or telephony integration — out of scope, flagged as a future backend change.
- Full i18n/E.164 phone validation or a complete country list UI (a small fixed list is enough for this change).
- Persisting conversation history beyond the current editing session.
- Any event types beyond the call-preview conversation — the service is designed to carry more later, but no other event producers are added in this change.

## Decisions

### 1. Global `RealtimeService` in `src/app/core/realtime/`, connected once at app bootstrap

A single `RealtimeService` (`providedIn: 'root'`) owns one logical connection for the app's lifetime. It is kicked off once via an `APP_INITIALIZER` (or `provideAppInitializer` in the new Angular functional style) in `app.config.ts`, not lazily on first subscribe — so it's already "warm" by the time any feature needs it, matching the "always connected" requirement.

Public surface:
```ts
type RealtimeEvent =
  | { type: 'call.started'; agentId: string; callId: string }
  | { type: 'call.message'; agentId: string; callId: string; speaker: 'agent' | 'customer'; text: string; at: string }
  | { type: 'call.ended'; agentId: string; callId: string; outcome: 'completed' | 'failed' };
  // future event types append here as new union members

interface RealtimeService {
  readonly events$: Observable<RealtimeEvent>;      // multiplexed stream, all event types
  readonly connectionStatus$: Observable<'connecting' | 'open' | 'reconnecting' | 'closed'>;
}
```
Consumers (e.g. the Playground editor) `filter()` `events$` down to the event types and `callId` they care about, rather than each owning a separate connection. This is the crux of "multiplexed": one socket, many logical event streams, discriminated by `type`.

**Alternative considered**: a scoped `PreviewCallSocketService` opened per preview session. Rejected because it doesn't satisfy "always connected" and would need to be re-derived for every future streaming feature; a single shared connection is also cheaper and simpler to reason about for reconnect/backoff logic (one state machine, not N).

### 2. Mock transport now, real transport later, same public interface

`RealtimeService` depends on an injected `RealtimeTransport` abstraction:
```ts
interface RealtimeTransport {
  connect(): Observable<'open' | 'reconnecting' | 'closed'>;
  events(): Observable<RealtimeEvent>;
  send(event: RealtimeCommand): void; // e.g. { type: 'call.start'; agentId; phoneNumber }
}
```
For this change, `MockRealtimeTransport` implements this with an in-memory `Subject<RealtimeEvent>` and simulated timers (mirrors the existing `of(...).pipe(delay(...))` mock style used by `AgentService`): on `send({ type: 'call.start', ... })` it schedules a `call.started`, then a handful of `call.message` events a second or two apart alternating `agent`/`customer`, then a `call.ended`. `RealtimeService` itself never changes when a real `WebSocketRealtimeTransport` (using the native `WebSocket` or RxJS `webSocket()`) is introduced later — only the DI provider swaps, matching how a future real backend would replace `AgentService`'s in-memory arrays.

**Alternative considered**: mock only at the `AgentService`/HTTP layer and skip the transport abstraction, hard-coding a `Subject` inside `RealtimeService`. Rejected because it would need to be re-written (not just re-provided) when a real backend arrives, defeating the stated goal of a small later swap.

### 3. Call-initiation stays a normal mocked service call; only the response stream is realtime

Starting the call (`AgentService.callCustomer(agentId, { countryCode, phoneNumber })`) stays a conventional mocked `Observable<{ callId: string }>` on `AgentService`, consistent with `createAgent`/`updateAgent`. It does not itself carry conversation data — it just confirms the call was accepted and returns a `callId`, which the component then uses to filter `RealtimeService.events$`. This keeps the "start an action" and "observe its progress" concerns separate, which is also how this would work against a real backend (`POST /api/agents/:id/calls` returns `callId`; the socket then streams `call.*` events tagged with that `callId`).

### 4. Preview visibility and Go Live gating

`PlaygroundEditorComponent` adds a computed `previewAvailable = computed(() => !!this.agentId() && this.status() === 'draft')`; the preview section template is `*ngIf`/`@if`-gated on this instead of always rendering. `previewPassed` is now set only on receiving `call.ended` with `outcome: 'completed'` for the in-flight `callId`, and is still invalidated by the existing form `valueChanges`/`tools` effect (`invalidatePreview()`), unchanged from today. `previewTranscript: string` is replaced by `previewMessages: Signal<{ speaker: 'agent' | 'customer'; text: string }[]>`, appended to as `call.message` events arrive.

### 5. Phone number input: fixed country list, no new dependency

A small local `COUNTRY_CODES` list (reusing the shape/spirit of the existing `CURRENCIES` constant in `agent.model.ts`), rendered as a `<select>` next to a plain `<input>` for the national number, side by side in the template. Validation: country selected, number is digits-only and within a plausible length range (e.g. 6–12 digits) — enough to prevent obviously-bad submissions without pulling in a phone-number library, per the earlier scoping decision to keep this simple.

## Risks / Trade-offs

- **[Risk]** A single global socket becomes a dumping ground for unrelated event types over time, making `events$` hard to reason about. → **Mitigation**: strict discriminated union on `type`, consumers always `filter()` before use; revisit with per-domain sub-services if the union grows large.
- **[Risk]** Mocked timing (fixed delays between `call.message` events) may not resemble real latency/jitter once a backend exists, so UI edge cases (slow first message, dropped connection mid-call) go untested now. → **Mitigation**: `MockRealtimeTransport` includes a `call.ended` with `outcome: 'failed'` path and randomized inter-message delay so the UI is exercised against non-happy-path timing too.
- **[Risk]** `APP_INITIALIZER`-based connect means the socket opens even on routes that never use realtime features, which is wasted work against a real backend. → **Mitigation**: acceptable for a mock; when swapping in a real transport, connect lazily on first `events$` subscription if this becomes a real cost, without changing the public interface.
- **[Risk]** Removing `previewCall` and `previewTranscript` is a breaking change to any other code referencing them. → **Mitigation**: confirmed via research these are only referenced within `AgentService` and `PlaygroundEditorComponent`; no other consumers exist.

## Migration Plan

1. Add `RealtimeService`/`RealtimeTransport`/`MockRealtimeTransport` and event types in `src/app/core/realtime/`, wire up app-init connection.
2. Add `AgentService.callCustomer(...)`; remove `previewCall(...)`.
3. Rework `PlaygroundEditorComponent` preview section: visibility gate, phone form, subscribe-and-filter on `events$`, new gating logic.
4. Update `openspec/specs/agent-preview-call/spec.md` (delta) and add `openspec/specs/realtime-events/spec.md` (new) once implementation lands (via `opsx-sync`).

No data migration or rollback concerns — this is a frontend-only, mock-backed feature with no persisted state beyond the current browser session.

## Open Questions

- When a real backend exists, does call initiation happen over REST (`POST /api/agents/:id/calls`) with the socket only used for the resulting stream, or does the whole thing move over the socket (a `call.start` command message)? This design supports both since `AgentService.callCustomer` and `RealtimeTransport.send` are separate seams; decide when the real backend is scoped.
- Should `RealtimeService` eventually expose per-domain filtered observables (e.g. `callEvents$`) instead of making every consumer filter the raw `events$`? Worth revisiting once a second event-producing feature exists.
