## Why

The Preview tab only lets a customer test their agent via a simulated phone call. The same agent could also be deployed as a chatbot, but there's no way to test that conversational/tool-calling behavior without going live first. Customers need to be able to chat with their draft agent directly — sending real messages and seeing real (mocked) tool activity — as an equally valid way to validate it before Go Live.

## What Changes

- The Preview tab gains two sub-tabs: **Call** (today's existing phone-call simulation, unchanged in behavior) and **Chat** (new) — via a new parent component that owns the sub-tab switching.
- **Chat preview**: the tester types messages as the customer and receives (mocked) agent replies in a real interactive back-and-forth, unlike the Call preview's fully-scripted simulation. When the agent's reply involves a tool ("operations" — creating/updating/looking up something), an inline tool-execution card appears in the transcript showing the tool name, input, output, and success/error status — matching how the Call Log detail modal already visualizes tool calls.
- The tester explicitly ends a chat session ("End Chat"); ending a session that had at least one real exchange marks that Chat preview as successful.
- **Go Live gating changes**: a successful Chat preview now satisfies the "must complete a Preview" requirement for Go Live, exactly like a successful Call preview already does — either mode counts. This gating rule moves conceptually to the `playground` capability (it's a Playground-level rule about "any successful preview", not specific to the call mode), while each preview mode capability just defines what "successful" means for itself.
- **Refactor**: the existing inline call-preview markup/logic in `playground-editor.component.ts`/`.html` (phone form, call state, realtime call listening) is extracted into its own `CallPreviewComponent`, matching the new `ChatPreviewComponent` as siblings under a new `PreviewPanelComponent` parent. `PlaygroundEditorComponent` no longer owns any call/chat-specific state directly — it only owns the shared `previewPassed` flag that either child can set.
- `RealtimeEvent`/`RealtimeCommand` gain `chat.*` variants (start, send, message, tool_call, ended), simulated by the same mock transport used for calls, sharing the one realtime connection per the existing `realtime-events` capability.

## Capabilities

### New Capabilities
- `agent-preview-chat`: Interactive chat-based preview of a draft agent — real user-typed messages, mocked agent replies, inline tool-execution visibility, explicit session end.

### Modified Capabilities
- `agent-preview-call`: Preview Draft Agent requirement reworded to describe living in the "Call" sub-tab of Preview (no behavior change). The "Preview Gates Go Live" requirement moves to `playground` (see below), since it's no longer call-specific.
- `playground`: The Preview tab now hosts Call/Chat sub-tabs via a preview panel; gains the (moved, generalized) "Preview Gates Go Live" requirement covering either mode.
- `realtime-events`: Gains a scenario confirming chat events share the same global connection as call events, per the capability's existing multiplexed-event-stream design.

## Impact

- Affected frontend: `src/app/core/realtime/realtime.types.ts` (`chat.*` event/command variants), `mock-realtime-transport.ts` (chat simulation), new `src/app/features/playground/preview-panel/`, `call-preview/`, `chat-preview/` components, `playground-editor.component.ts`/`.html` (remove extracted call-preview state/logic, mount the new preview panel, keep only the shared `previewPassed` signal and the `toolsWatcher`-style invalidation effect).
- No backend/API changes; chat replies and tool-call outcomes remain mocked, consistent with the rest of the app.
- No changes to the Call preview's actual behavior — this is a structural extraction plus a new sibling mode, not a rewrite of calling.
