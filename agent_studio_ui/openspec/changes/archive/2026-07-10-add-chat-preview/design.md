## Context

Today's Preview tab is entirely owned by `PlaygroundEditorComponent`: `phoneForm`, `callStatus`, `previewMessages`, `activeCallId`, `startPreviewCall()`, `listenToCall()`, `handleCallEvent()` all live directly on that component, driven by `RealtimeService`/`RealtimeEvent` (`call.started`/`call.message`/`call.ended`) from a mocked transport (`MockRealtimeTransport`) that fully scripts both sides of a simulated phone call with no real user input during the call itself.

The user wants a second preview mode — an interactive chat, where the tester actually types customer messages and sees mocked agent replies, including visible tool ("operations") activity — presented as a sibling sub-tab next to Call, both under the existing Preview tab. This requires pulling the call-specific state out of `PlaygroundEditorComponent` into its own component so it can sit next to a new chat component under a shared tab-switching parent, matching the array-resource extraction pattern already used repeatedly in this codebase (Export Destinations, MCP Servers, Knowledge Base — each is its own component, not inlined in the editor).

## Goals / Non-Goals

**Goals:**
- Preview tab shows Call/Chat sub-tabs via a new `PreviewPanelComponent`.
- Extract today's call-preview logic unchanged in behavior into `CallPreviewComponent`.
- New `ChatPreviewComponent`: real interactive text chat, mocked agent replies, inline tool-execution cards, explicit "End Chat" that marks the session successful (given at least one real exchange).
- Either a successful Call or successful Chat preview satisfies Go Live's "must have a successful preview" gate; either state resets on further agent edits, exactly like today.
- Reuse the existing realtime plumbing (`RealtimeService`, mock transport) rather than inventing a parallel chat-specific service.

**Non-Goals:**
- No real LLM-backed chat — replies remain canned/mocked, consistent with the rest of the app.
- No persistence of chat transcripts — like call previews today, a chat preview is session-only, discarded on navigation away.
- No change to the Call preview's actual simulation behavior (scripted both-sides conversation, 15% random failure) — purely a structural extraction.

## Decisions

**Component split**: `PreviewPanelComponent` (`[agentId]: string`, `(previewPassed): void`) owns a small internal `activeMode = signal<'call' | 'chat'>('call')` and renders `<app-call-preview>` / `<app-chat-preview>` accordingly, forwarding whichever child's `(passed)` output fires up as its own `previewPassed`. `PlaygroundEditorComponent` mounts `<app-preview-panel [agentId]="agentId()!" (previewPassed)="onPreviewPassed()" />` in place of today's inline phone-form markup, and no longer holds `phoneForm`/`callStatus`/`previewMessages`/`activeCallId`/`startPreviewCall`/`listenToCall`/`handleCallEvent` at all — those move to `CallPreviewComponent` verbatim. The "Go Live" button stays in `PlaygroundEditorComponent` (it's a Playground-level action, not preview-mode-specific), still driven by the shared `previewPassed` signal.

**Each child owns its own lifecycle**: `CallPreviewComponent` and `ChatPreviewComponent` each take `[agentId]: string` and manage their own internal state/subscriptions, resetting when `agentId` changes (`ngOnChanges`) — mirroring how `AgentHistoryPanelComponent` etc. are self-contained. Switching between Call and Chat sub-tabs does not destroy the inactive one's state by default (Angular `@if` would recreate on toggle) — that's acceptable here since each mode's "in-progress" state (a ringing call, a chat mid-message) isn't meant to persist silently in the background while the user looks at the other tab; simplicity wins over preserving a hidden mode's state.

**Chat realtime model**: extend `RealtimeEvent` with `{ type: 'chat.started'; agentId; sessionId }`, `{ type: 'chat.message'; agentId; sessionId; speaker: 'agent'|'customer'; text; at }`, `{ type: 'chat.tool_call'; agentId; sessionId; toolName; input: Record<string, unknown>; output: string; status: 'success'|'error'; at }`, `{ type: 'chat.ended'; agentId; sessionId; outcome: 'completed' }`; extend `RealtimeCommand` with `{ type: 'chat.start'; agentId; sessionId }` and `{ type: 'chat.send'; agentId; sessionId; text }`. `sessionId` plays the same correlating role `callId` plays for calls. Chat only ever ends with outcome `'completed'` (user-initiated, no random failure) — unlike calls, there's no telephony-style flakiness to simulate for a text session.

**Mock chat behavior** (`MockRealtimeTransport`): on `chat.start`, emit `chat.started` then a short-delayed agent greeting `chat.message` (bot opens the conversation, like a real chat widget). On each `chat.send`, after a short delay emit an agent `chat.message` reply drawn from a small canned pool; with ~35% probability, precede that reply with a `chat.tool_call` event (drawn from a small local tool library — lookup/create/update/cancel-style operations, mirroring the flavor already established in `call-records.mock.ts`'s `TOOL_LIBRARY`, but defined locally here since it's a different, live-preview context, not history playback) with a ~85% success rate. There's no `chat.end` command from the mock side — ending is purely a client-side UI action (see next).

**Ending a chat session**: `ChatPreviewComponent` has an "End Chat" button, enabled once at least one customer message has been sent and at least one agent reply received. Clicking it locally marks the session ended (no realtime command needed — chat has no server-side "hang up" concept) and emits `(passed)` if that minimum exchange threshold was met.

**Go Live gating moves to `playground`**: `agent-preview-call`'s existing "Preview Gates Go Live" requirement is removed from that capability (via a REMOVED delta with migration note) and replaces/extends into a `playground` requirement worded around "a successful Call or Chat preview in the current session" — because after this change, gating is no longer specific to the call mode. `PlaygroundEditorComponent`'s existing `toolsWatcher`-style effect (which invalidates a passed preview on any tools/mcpServers/knowledgeBase/form change) is unchanged — it already operates on the single shared `previewPassed` signal regardless of which mode set it.

## Risks / Trade-offs

- [Extracting call-preview logic is a real refactor of working code, not purely additive] → Mitigated by keeping the extracted `CallPreviewComponent`'s internals byte-for-byte equivalent to today's logic (same form, same event handling, same messages), verified by re-running the existing call-preview verification scenarios after the extraction.
- [Two independent "was this session's preview successful" sources of truth (call vs chat) feeding one shared flag] → Kept simple: both children only ever emit `(passed)`, never explicitly "un-pass" — invalidation on edit remains centralized in `PlaygroundEditorComponent`'s existing effect, so there's exactly one place a passed preview gets cleared.
- [Chat's tool-call mock library duplicates some flavor from `call-records.mock.ts`] → Acceptable, small, and intentionally decoupled (a live preview tool call and a historical call-log tool call are different contexts); not worth a shared abstraction for a handful of canned strings.

## Open Questions

- None blocking. A "regenerate agent reply" or multi-turn tool chaining is a natural future enhancement, not needed here.
