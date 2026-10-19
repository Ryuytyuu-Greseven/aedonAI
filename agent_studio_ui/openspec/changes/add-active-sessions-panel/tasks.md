## 1. Model & Mock Data

- [x] 1.1 Add `ActiveSession` model to `src/app/core/models/active-session.model.ts` (`id`, `agentId`, `customerName`, `phoneNumber`, `direction`, `startedAt`), following the field conventions of `CallRecord`.
- [x] 1.2 Add a mock fixture (`src/mocks/active-sessions.mock.ts`) with a small in-memory generator that produces a plausible, changing set of active sessions per `agentId` (sessions starting/ending across time windows) — mirroring how `src/mocks/call-records.mock.ts` is structured.

## 2. Service

- [x] 2.1 Add `ActiveSessionService` (`src/app/core/services/active-session.service.ts`), `providedIn: 'root'`, with `getActiveSessions(agentId: string): Observable<ActiveSession[]>` backed by the mock fixture (`of(...).pipe(delay(...))`), matching `CallRecordService`'s mock-vs-API split pattern.
- [x] 2.2 Document on the service (short comment, matching `CallRecordService`'s convention) that this is mock-only pending a real backend endpoint.

## 3. Active Sessions Tab Component

- [x] 3.1 Create `ActiveSessionsComponent` (`src/app/features/monitor-agents/active-sessions/`) — standalone, `[agentId]` input — that fetches `getActiveSessions(agentId)` on init and on a poll interval (~9s), cleared in `ngOnDestroy`.
- [x] 3.2 Add a client-side ticking elapsed-duration computation per session (derived from `startedAt`), updated every second, cleared in `ngOnDestroy`.
- [x] 3.3 Add `@Output() joinSession = new EventEmitter<ActiveSession>()`; add a `joiningSessionId` signal to drive the per-row "Joining…" transient state (emit on click, flip state, reset after ~2s).
- [x] 3.4 Template: live count badge, active session cards in a responsive grid (customer/phone, direction chip via `stat-pill`, ticking duration, live pulse dot, "View" and "Join" `btn btn-sm` actions), and a `.empty-state` block for zero active sessions.
- [x] 3.5 Style the component (`active-sessions.component.css`) using existing spacing/radius/color variables — no new hard-coded colors.

## 4. Monitor Detail Tab Wiring

- [x] 4.1 Add `'active-sessions'` to `MonitorTab` in `monitor-detail.component.ts`; import and register `ActiveSessionsComponent`.
- [x] 4.2 Add the "Active Sessions" tab button in `monitor-detail.component.html`, alongside Overview/Call Log/Actions/Reports.
- [x] 4.3 Add the tab content branch rendering `<app-active-sessions [agentId]="currentAgent.id" (joinSession)="onJoinSession($event)" />` inside the existing `card`/`card-body` shell used by the other tabs.
- [x] 4.4 Add `onJoinSession(session: ActiveSession)` to `MonitorDetailComponent`, wired to `ToastService.info(...)` as interim feedback (per design.md Decision 4).

## 5. Global Styles

- [x] 5.1 Add `.live-dot-pulse` keyframe animation to `src/styles/globals.css`, built from existing `--success`/`--success-bg` variables only; leave the existing `.live-dot` used elsewhere unchanged.
- [x] 5.2 Promote `.stat-pill`/`.stat-pill-row` and the `.timeline*` chat-bubble classes from `call-detail-modal.component.css` into `globals.css` as shared classes (fixes them being silently unscoped from any other component per Angular view encapsulation), and switch `ActiveSessionsComponent` from a row list to a card grid (`.active-session-grid`/`.active-session-card`) with a hover lift.

## 6. Live Conversation View

- [x] 6.1 Add `LiveMessage` model (`src/app/core/models/active-session.model.ts`) and a mock generator `generateLiveMessages(session, atMs)` (`src/mocks/live-call-messages.mock.ts`) that deterministically replays a growing agent/customer message exchange from the session's `startedAt`.
- [x] 6.2 Add `ActiveSessionService.getLiveMessages(session): Observable<LiveMessage[]>`, mock-backed like `getActiveSessions`.
- [x] 6.3 Create `LiveCallModalComponent` (`src/app/features/monitor-agents/live-call-modal/`) — `[session]` input, polls messages (~4s) and ticks duration (~1s), both cleared in `ngOnDestroy`; renders the chat-style transcript via the promoted `.timeline` classes, distinguishing agent vs. customer, with a waiting state when there are no messages yet and an ambient "typing" indicator.
- [x] 6.4 Add a "Join call" action in the live conversation view emitting the same `joinSession` output, and auto-scroll to the latest message on each poll.
- [x] 6.5 Wire "View" on each `ActiveSessionsComponent` card to open `LiveCallModalComponent` for that session (`viewingSession` signal), bubbling its `joinSession` output up to `MonitorDetailComponent`'s existing toast handler.

## 7. Verification

- [ ] 7.1 Run the app, open an agent's Monitor Detail, click "Active Sessions": confirm the card grid renders, durations tick, join gives visible feedback, and the list refreshes as mock sessions start/end.
- [ ] 7.2 Confirm the empty state renders correctly for an agent with no active sessions.
- [ ] 7.3 Click "View" on a card: confirm the live conversation opens, shows the transcript so far, new messages appear over time, and "Join call" gives the same visible feedback as the card's Join button.
- [ ] 7.4 Confirm the Call Log tab and Call Detail Modal are unchanged (no Active Sessions content inside them, timeline/stat pills still render correctly there post-promotion-to-globals).
- [ ] 7.5 Check both light and dark theme (`data-theme`) rendering of the card grid, pulse animation, and live conversation view.
