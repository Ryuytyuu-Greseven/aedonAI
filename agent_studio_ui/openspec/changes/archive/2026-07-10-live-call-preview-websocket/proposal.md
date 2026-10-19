## Why

Preview today is a dead end: it saves the draft, then fabricates a canned transcript string client-side, so a customer never actually hears/sees how their agent handles a real call before going live. We need Preview to place a real call to a phone number the customer supplies and show the live agent/customer conversation as it happens, which requires a persistent channel from the backend to the frontend rather than a one-shot mock response.

## What Changes

- **BREAKING**: Remove the mock canned-transcript preview (`AgentService.previewCall`) entirely.
- The Preview action/UI is now only shown once the agent already has an `id` and `status: 'draft'` (i.e., after a successful explicit Save). Preview no longer performs an implicit first save — if the agent has never been saved, the Preview UI is not shown at all (replaces the old "Preview triggers first save" behavior).
- Add a phone-number capture step to Preview: a country-code selector and a mobile-number input, shown side by side, with basic validation before the call can be started.
- Add a "Call Customer" action that submits the captured phone number to a (mocked) backend API to initiate an outbound call to that number using the draft agent.
- Add a live conversation view in Preview that renders agent/customer messages as chat bubbles, populated incrementally as events arrive over a WebSocket connection, replacing the static transcript block.
- Introduce a global, always-on WebSocket service (`src/app/core/`) that connects once at app startup, stays connected for the app's lifetime, handles basic reconnect, and exposes a single multiplexed stream of typed events (discriminated union). The live-call conversation is one event type on this stream; the service is designed so other future event types can share the same connection.
- Since there is no real backend yet, both the "Call Customer" API and the WebSocket connection are mocked in-memory (matching the existing mock pattern used by `AgentService`), but with an interface shaped like a real client so a real backend can be swapped in later without changing call sites.
- "Go Live" gating (`previewPassed`) now keys off a successfully completed live-call preview (call connected, conversation streamed, call ended) instead of the old mock-transcript-returned condition. Any subsequent edit to the agent still invalidates the passed preview, as today.

## Capabilities

### New Capabilities
- `realtime-events`: A global, always-connected WebSocket service providing a single multiplexed, typed event stream for the whole app (mocked in-memory for now, real-client-shaped interface), used to receive live server-pushed events such as call conversation messages.

### Modified Capabilities
- `agent-preview-call`: Preview no longer triggers an implicit save and no longer returns a mock transcript. It is only available after a draft has been saved, requires capturing a customer's country code + mobile number, initiates a (mocked) outbound call via a backend API, and displays the resulting conversation as it streams in live over the `realtime-events` WebSocket. "Go Live" gating now depends on a successfully completed live call rather than a returned mock transcript.

## Impact

- `src/app/features/playground/playground-editor/playground-editor.component.ts` / `.html`: preview UI reworked (visibility condition, phone-number form, live conversation rendering); `previewPassed`/`previewTranscript` state replaced with call-status/conversation state driven by the WebSocket stream.
- `src/app/core/services/agent.service.ts`: remove `previewCall`; add a mocked `callCustomer(agentId, phoneNumber)` method.
- `src/app/core/` (new): global WebSocket service, event-type definitions, and a mock server/event-simulator used until a real backend exists.
- `src/app/app.config.ts` (or main bootstrap): wire up the WebSocket service to connect at app init.
- `openspec/specs/agent-preview-call/spec.md`: requirements rewritten per the above.
- `openspec/specs/realtime-events/spec.md` (new): documents the global WebSocket capability.
- No change to routing (`app.routes.ts`) or to `playground`/`agent-clone`/`export-destinations` capabilities.
