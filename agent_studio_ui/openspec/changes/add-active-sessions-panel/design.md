## Context

`MonitorDetailComponent` (`src/app/features/monitor-agents/monitor-detail/`) already renders a tabbed page per agent — Overview, Call Log, Actions, Reports — driven by a `MonitorTab` union and an `activeTab` signal, each tab lazily rendering its own child component (`app-call-log`, `app-agent-reports`, `app-action-items`). There is no concept anywhere in the app today of a call that is *currently in progress*: `CallRecord`/`CallDetail` (used by the Call Log tab and its `CallDetailModalComponent`) model a finished call only.

This change adds a new, independent tab — **Active Sessions** — showing the calls the agent is on **right now**. It was initially prototyped as a section inside `CallDetailModalComponent` (the historical call detail popup), but that coupled "calls happening now" to "a specific past call's detail view," which don't belong together — a monitor wants to see active sessions without first picking a historical call to open. This design instead adds it as its own tab, matching how Call Log/Actions/Reports are already structured, and leaves `CallDetailModalComponent` untouched.

The backend for this (a real "list active sessions" endpoint and a real way to join a live call's audio) does not exist yet and is being built separately. This change is scoped to the frontend shape and interaction only, backed by a mock service, so the design can be reviewed before backend work starts.

Prior art to follow:
- `CallRecordService` (`src/app/core/services/call-record.service.ts`) — the mock/API split pattern (`ApiService` for real endpoints, local mock array + `of(...).pipe(delay(...))` for what isn't backed yet).
- `.live-pill` / `.live-dot` in `src/styles/globals.css` — already used in `monitor-list` and `monitor-detail` to mark an agent as Live.
- `AudioProcessorWsService` (from `add-web-call-preview`) — the existing pattern for a per-session WebSocket connection with its own Rx subjects. Not used by this change, but the natural home for real "join" audio once the backend exists.
- The existing `MonitorTab` tab-switching pattern in `MonitorDetailComponent` (`@if (activeTab() === 'call-log') { <app-call-log .../> }`) — each tab's child component is only instantiated while its tab is active, which is how this feature gets its polling lifecycle scoped for free (start on tab entry, stop via `ngOnDestroy` on tab switch).

## Goals / Non-Goals

**Goals:**
- Add a self-contained **Active Sessions** tab to Monitor Detail showing a live-updating list of the agent's in-progress calls.
- Give each one a one-click "Join" affordance, wired to a clear extension point for real backend joining later.
- Reuse existing theme variables, global classes (`card`, `btn`, `stat-pill`, `.live-pill`/`.live-dot`, `.empty-state`), and animation conventions — introduce no new color values.
- Keep the Call Log tab and Call Detail Modal (historical single-call view) completely unchanged.

**Non-Goals:**
- Implementing the real backend endpoint for listing active sessions, or the real mechanism (WebSocket audio bridge, SIP transfer, etc.) for a human to actually join a live call's audio. `joinSession` is an output event; wiring it to something real is a follow-up change once the backend exists.
- Building any "listen-only" vs "barge-in" distinction — out of scope until product/backend defines it.
- Surfacing active-session state anywhere other than its own tab (e.g. no badge/count on the tab button itself, or elsewhere in the list/detail views) — kept minimal until there's a real signal worth surfacing more prominently.

## Decisions

### 1. New capability, new model/service, not an extension of `CallRecord`
`ActiveSession` is a distinct model (`src/app/core/models/active-session.model.ts`) from `CallRecord` — an active session has no `outcome`, no `total_tokens`/`cost_usd` totals, no fixed `duration_seconds` (it's still running). Reusing `CallRecord` with optional/nullable fields would force every consumer of `CallRecord` to handle an "in progress" case that never applies to them. A parallel `ActiveSessionService` (`src/app/core/services/active-session.service.ts`) mirrors `CallRecordService`'s mock pattern: a local mock generator, `of(...).pipe(delay(...))`, ready to swap for a real `ApiService` call later without changing its public method signature (`getActiveSessions(agentId): Observable<ActiveSession[]>`).

### 2. Live duration computed client-side from `startedAt`, not server-pushed
Each `ActiveSession` carries a fixed `startedAt: string` (ISO timestamp). The component computes elapsed time client-side on a 1s interval (`signal` + `setInterval`, cleared in `ngOnDestroy`), the same way a real timer would once the backend only needs to tell us *when* the call started. This avoids inventing a fake "tick" protocol in the mock service that a real backend would never implement, and keeps the mock service honest about what a real one will send.

### 3. Polling, not push, for the session list itself
`ActiveSessionService.getActiveSessions()` returns a snapshot `Observable`. `ActiveSessionsComponent` re-fetches on a short interval (~9s) via `setInterval` while its tab is active, so new calls appearing / calls ending are reflected without a manual refresh, without requiring a websocket for this list. Because the component only exists in the DOM while its tab is selected (per the `@if (activeTab() === ...)` pattern already used for the other tabs), switching away naturally stops the polling via `ngOnDestroy` — no visibility/active-tab bookkeeping needed beyond what the pattern already gives.

### 4. Join is an `@Output()`, not a router navigation or inline call
`ActiveSessionsComponent` exposes `@Output() joinSession = new EventEmitter<ActiveSession>()`. Clicking "Join" on a row emits immediately and the button flips to a brief "Joining…" disabled state (self-resetting after ~2s) purely as visual feedback — it does not assume any real join happened. `MonitorDetailComponent` handles the output with `ToastService.info(...)` as interim feedback so the affordance doesn't feel broken pre-backend. Making this an output event (rather than the component reaching into a join service directly) keeps it decoupled from however joining is eventually implemented (most likely something adjacent to `AudioProcessorWsService`).

### 5. A tab, not a modal section — separate concerns, separate lifecycle
Active Sessions is its own `MonitorTab` value (`'active-sessions'`) and its own component (`ActiveSessionsComponent`), rendered the same way `app-call-log`/`app-agent-reports`/`app-action-items` are: `@if (activeTab() === 'active-sessions') { <app-active-sessions [agentId]="currentAgent.id" (joinSession)="onJoinSession($event)" /> }`, wrapped in the same `card`/`card-body` shell the other tabs use. This keeps "what's happening now" (agent-scoped, ongoing) separate from "what happened on this specific past call" (`CallDetailModalComponent`, call-scoped, historical) — they have different subjects and different lifecycles, and conflating them made the modal do two unrelated jobs. The empty state (agent has zero active sessions, the common case) uses the existing global `.empty-state` class already used by Call Log's empty states, so it reads as native to the page rather than a bolted-on widget.

### 6. Visual language: extend `.live-pill`/`.live-dot`, add one pulse keyframe
Add a `.live-dot-pulse` variant in `globals.css` (a `box-shadow` ring `@keyframes` pulse in `var(--success)`, using `--success`/`--success-bg` already defined per-theme) applied to each active-session card's dot and the tab's "N live now" badge, so live entries read as "actively happening" versus the static `.live-dot` used for the agent-level Live badge in the page header. No new hex values — animation only varies opacity/scale of the existing success color.

### 7. Cards, not table rows
Active sessions render as a responsive card grid (`.active-session-grid`, `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`) rather than full-width list rows — each `.active-session-card` is a small, self-contained unit (live dot + duration, customer identity, direction pill, View/Join actions) with a hover lift (`translateY` + `--shadow-md`). A grid of independent, glanceable units suits "which of these several simultaneous things needs my attention" better than a table, which implies row-to-row comparison across shared columns that don't really apply here (there's no sort/filter need at this scale). This also surfaced (and fixed) a pre-existing bug: `.stat-pill`/`.stat-pill-row` and the `.timeline*` chat-bubble classes were only ever defined inside `call-detail-modal.component.css`, so Angular's view encapsulation silently scoped them out of any other component that used the same class names (including this one). Both sets are now promoted to `globals.css` as shared, encapsulation-safe classes — matching how `.live-pill`/`.live-dot` were already global — rather than re-duplicating the rules per component.

### 8. Live conversation view: a second modal, not an inline expansion
Clicking "View" on a card opens `LiveCallModalComponent` (`src/app/features/monitor-agents/live-call-modal/`) — a focused, chat-style transcript for that one session, reusing the promoted `.timeline`/`.timeline-message-agent`/`.timeline-message-customer` classes from Decision 7 so it looks native to the same chat-bubble language already established by the historical Call Detail Modal. It's a separate modal (not an inline expansion of the card, and not a reuse of `CallDetailModalComponent`) because: the subject is fundamentally different (a growing live transcript vs. a fixed historical one), it needs its own polling/ticking lifecycle scoped to "modal open," and an inline expansion inside a grid card would fight the fixed card size this layout depends on. `ActiveSessionsComponent` tracks at most one open view via a `viewingSession` signal (`@if (viewingSession(); as viewed) { <app-live-call-modal ... /> }`), mirroring how `MonitorDetailComponent` already tracks `selectedCall` for the historical modal. A "Join call" action is included in this view too (same `joinSession` output, bubbled up through `ActiveSessionsComponent`) since a monitor reading the live transcript is a natural moment to decide to join.

### 9. Live messages: same recompute-from-scratch mock technique as everything else
`generateLiveMessages(session, atMs)` (`src/mocks/live-call-messages.mock.ts`) reseeds a PRNG from the session id and replays forward from a fixed first-message offset, appending messages at a jittered ~9s average cadence until it passes `atMs`. Recomputing the whole list from scratch each call (rather than mutating a stored buffer) keeps it consistent with `generateCallDetail`'s and `generateActiveSessions`'s existing style: deterministic per identity, growing naturally as time advances, no separate persistence layer for a mock. The view polls this on a faster ~4s interval (vs. the ~9s session-list poll) since a chat transcript reads as more "live" than a session roster, and auto-scrolls to the newest message on each fetch.

## Risks / Trade-offs

- **Mock data won't feel "live" without care** → the mock service should simulate sessions starting/ending across poll cycles (not a perfectly static list) so the reviewed design is judged against realistic churn, not a frozen snapshot.
- **Join button with no real backend could read as broken** → mitigated by the self-resetting "Joining…" state and the interim toast (Decision 4); it's explicit UI-only feedback, not a fake success state.
- **Polling interval choice is a guess** (~9s) with no real traffic to validate against → cheap to change later since it's a single constant in the component; not worth over-engineering with backoff/config now.
- **Future backend shape is unknown** → keeping `ActiveSessionService`'s method signature narrow (`getActiveSessions(agentId): Observable<ActiveSession[]>`) and `joinSession` as a plain output event minimizes what has to change when the real API/join mechanism lands.

## Open Questions

- Should "Join" eventually distinguish listen-only monitoring from full barge-in? Deferred to the backend design change.
- Should the tab itself surface a live-count badge so a monitor doesn't have to click into it to know something's happening? Deferred — deliberately left out of this pass (see Non-Goals) to keep the first version minimal; easy to add once there's real usage signal.
