## Why

A human monitoring a live agent today has no way to see who that agent is currently on a call with, or to jump into a conversation that's going wrong. Monitor Detail only ever shows historical/aggregate data (Overview, Call Log, Reports) — there is no view of calls that are happening *right now*. Surfacing live, in-progress calls (and a one-click way to join them) lets a monitor catch and rescue a bad call while it's still salvageable, instead of only reviewing it after the fact.

## What Changes

- Add a new **Active Sessions** tab to the Monitor Detail page (alongside Overview, Call Log, Active Sessions, Actions, Reports) listing the calls currently in progress for that agent as a responsive grid of cards (not a table), each showing customer/phone, live duration (ticking), and direction. This is deliberately kept separate from the Call Log / Call Detail Modal, which stays focused on historical calls only.
- Each active session card gets a **Join** action so a monitor can hop into that live call with one click, and a **View** action opening a live, chat-style conversation view for that call — a chronological, chat-bubble transcript that visually distinguishes agent and customer messages and grows in real time as the (mocked) call continues, with its own Join action.
- Add a frontend-only `ActiveSessionService` (mock-backed, following the existing `CallRecordService` mock pattern) that polls/emits the current set of active sessions for an agent, plus the growing message transcript for a given session. No real backend call-join wiring yet — that is explicitly out of scope for this change and will be handled separately when the backend is ready.
- Visual treatment: a live/pulse indicator consistent with the existing `.live-pill` / `.live-dot` styling already used in `monitor-list` and `monitor-detail`, built entirely from existing theme CSS variables (`src/styles/variables.css`) and global classes — no new one-off colors.
- Empty state when the agent has no active sessions (most of the time, for most agents).

## Capabilities

### New Capabilities
- `active-call-sessions`: Live, in-progress call sessions for an agent — listing them and joining one from the monitor UI.

### Modified Capabilities
- `monitor-agents`: Monitor Detail gains an "Active Sessions" tab (a new requirement), alongside its existing Overview/Reports/Call Log tabs.

## Impact

- `src/app/features/monitor-agents/active-sessions/` — `ActiveSessionsComponent` (`.html`/`.css`/`.ts`) rendering the tab content as a card grid.
- `src/app/features/monitor-agents/live-call-modal/` — new `LiveCallModalComponent` (`.html`/`.css`/`.ts`) for the live chat-style conversation view, opened from a card's "View" action.
- `src/app/features/monitor-agents/monitor-detail/` — new tab button + content branch, wiring `(joinSession)`.
- New mock service + models (`src/app/core/services/active-session.service.ts`, `src/app/core/models/active-session.model.ts`: `ActiveSession` + `LiveMessage`) and mock data fixtures (`src/mocks/active-sessions.mock.ts`, `src/mocks/live-call-messages.mock.ts`), mirroring `call-record.service.ts` / `call-record.model.ts` / `mocks/call-records.mock.ts`.
- `src/styles/globals.css` — extend the existing `.live-pill`/`.live-dot` pattern with a `.live-dot-pulse` variant; also promotes `.stat-pill`/`.stat-pill-row` and the `.timeline*` chat-bubble classes (previously scoped only inside `call-detail-modal.component.css`, and therefore inert outside it) into shared global classes used by both modals.
- `call-detail-modal.component.css` loses the now-duplicate `.stat-pill`/`.timeline*` rules; `call-detail-modal.component.ts`/`.html` are otherwise unchanged — the historical single-call view stays exactly as it was.
- Backend/API for real active sessions, live transcripts, and actually joining a live call is out of scope — this change ships a frontend-only, mock-backed design for review.
