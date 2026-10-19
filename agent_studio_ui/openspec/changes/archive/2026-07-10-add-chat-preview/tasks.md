## 1. Realtime Event/Command Model

- [x] 1.1 In `src/app/core/realtime/realtime.types.ts`, add to `RealtimeEvent`: `chat.started { agentId; sessionId }`, `chat.message { agentId; sessionId; speaker: 'agent'|'customer'; text; at }`, `chat.tool_call { agentId; sessionId; toolName; input: Record<string, unknown>; output: string; status: 'success'|'error'; at }`, `chat.ended { agentId; sessionId; outcome: 'completed' }`
- [x] 1.2 Add to `RealtimeCommand`: `chat.start { agentId; sessionId }`, `chat.send { agentId; sessionId; text }`
- [x] 1.3 In `mock-realtime-transport.ts`, handle `chat.start`: emit `chat.started`, then a short-delayed agent greeting `chat.message`
- [x] 1.4 Handle `chat.send`: after a short delay, emit an agent `chat.message` reply from a small canned pool; ~35% of the time, precede it with a `chat.tool_call` event drawn from a small local tool library (lookup/create/update/cancel-style operations), ~85% success rate

## 2. Call Preview Extraction

- [x] 2.1 Scaffold `src/app/features/playground/call-preview/call-preview.component.ts` (+ `.html`, `.css`) with `[agentId]: string` input and `(passed): void` output
- [x] 2.2 Move `phoneForm`, `callStatus`, `previewMessages`, `activeCallId`, `startPreviewCall()`, `listenToCall()`, `handleCallEvent()`, and the associated markup/CSS verbatim from `playground-editor.component.ts`/`.html`/`.css` into this component; emit `(passed)` when a call ends with outcome `completed`
- [x] 2.3 Reset internal state on `agentId` change (`ngOnChanges`)

## 3. Chat Preview Component

- [x] 3.1 Scaffold `src/app/features/playground/chat-preview/chat-preview.component.ts` (+ `.html`, `.css`) with `[agentId]: string` input and `(passed): void` output
- [x] 3.2 On init (and `agentId` change), generate a `sessionId` and send `chat.start`; listen for `chat.*` events filtered by that `sessionId`
- [x] 3.3 Render the transcript: `chat.message` events as chat bubbles (agent/customer), `chat.tool_call` events as inline tool-execution cards (name, input, output, success/error styling) — reused the visual language from the Call Log detail modal's timeline (`.timeline`, `.timeline-message`, `.timeline-tool`, `.tool-status-badge`, etc.)
- [x] 3.4 Implement the message input + send action, dispatching `chat.send`; the customer's own message renders immediately (optimistic), agent replies arrive via the realtime event
- [x] 3.5 Implement "End Chat": disabled until at least one customer message sent and one agent reply received; on click, marks the session ended locally and emits `(passed)`
- [x] 3.6 Implement the "not yet saved" empty state ("Save the agent to start a preview chat"), consistent with the Call sub-tab's implicit gating

## 4. Preview Panel (Parent)

- [x] 4.1 Scaffold `src/app/features/playground/preview-panel/preview-panel.component.ts` (+ `.html`, `.css`) with `[agentId]: string` input and `(previewPassed): void` output
- [x] 4.2 Implemented an internal `activeMode` signal (`'call' | 'chat'`) with a Call/Chat sub-tab strip, reusing the global `.tabs`/`.tab`/`.tab-active` classes
- [x] 4.3 Renders `<app-call-preview>` / `<app-chat-preview>` based on `activeMode`, forwarding either child's `(passed)` output as `(previewPassed)`

## 5. Playground Editor Integration

- [x] 5.1 In `playground-editor.component.html`, replaced the inline Preview tab's phone-form/call markup with `<app-preview-panel [agentId]="agentId()!" (previewPassed)="onPreviewPassed()" />`; "Go Live"/"Cancel" actions row stays below it, still driven by the existing `previewPassed` signal
- [x] 5.2 In `playground-editor.component.ts`: removed `phoneForm`, `CallStatus`, `PreviewMessage`, `callStatus`, `previewMessages`, `activeCallId`, `startPreviewCall()`, `listenToCall()`, `handleCallEvent()`, and now-unused imports (`COUNTRY_CODES`, `Validators`, `RealtimeService`, `RealtimeEvent`, `filter`, `takeWhile`)
- [x] 5.3 Added `onPreviewPassed(): void { this.previewPassed.set(true); }`; simplified `invalidatePreview()` to just clear the shared flag (the extracted children now own their own transient call/chat UI state, consistent with how Tools/MCP Servers/Knowledge Base child components already work — parent only owns the canonical data/flags)

## 6. Verification

- [x] 6.1 Manually verify: Call sub-tab behaves identically to before the extraction (phone form, validation, live message streaming, completed outcome)
- [x] 6.2 Manually verify: Chat sub-tab starts with an agent greeting; sending messages produces real replies; a tool-execution card appears with correct name/input/output/status styling (confirmed within 6 messages, ~35% per-reply probability)
- [x] 6.3 Manually verify: "End Chat" is disabled until at least one real exchange, then ends the session successfully
- [x] 6.4 Manually verify: a successful Chat preview alone (no Call preview) unlocks "Go Live"
- [x] 6.5 Manually verify: a successful Call preview alone (no Chat preview) still unlocks "Go Live" (regression check passed)
- [x] 6.6 Manually verify: editing a field after a successful preview (either mode) invalidates it, hiding "Go Live" again
- [x] 6.7 Manually verify: switching between Call and Chat sub-tabs doesn't affect Build/Integrations/MCP Servers content or the agent's saved data
- [x] 6.8 Manually verify: no console errors throughout; Knowledge Base panel and History panel still work unchanged in the same editor
