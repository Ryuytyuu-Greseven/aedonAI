## 1. Dependencies

- [x] 1.1 Add `@fortawesome/fontawesome-free` to `package.json`; add its `css/all.min.css` to `angular.json` `styles`. **Deviation**: `js/all.min.js` was added to `scripts` first, per the literal request, but it bundles all icon styles (solid/regular/brands/duotone) unminified-by-tree-shaking at ~1.6MB and pushed the initial bundle to 2.01MB, hard-failing the existing 1MB production budget in `angular.json`. Removed it — the CSS+webfont approach (`all.min.css` alone) renders `<i class="fa-solid fa-...">` icons correctly without the JS/SVG runtime; the JS file is only needed for FontAwesome's alternate "SVG replace" technique, not for basic icon rendering. Flagging this for the user to confirm.
- [x] 1.2 Confirm no Bootstrap dependency is introduced (decision: skip Bootstrap, see design.md) — flag to the user if this should be revisited; verify FontAwesome CSS/JS does not clash with existing `styles/globals.css` resets.

## 2. Agent Model & Mock Data

- [x] 2.1 Extend `src/app/core/models/agent.model.ts`: add `status: 'active' | 'inactive' | 'draft'` (was `'active' | 'inactive'`), optional `base_template_id?: string`, `greeting?: string`. (Also added `prompt?: string` and `behavior?: string` — discovered during 6.2 that the "Customize Agent Configuration" requirement needs somewhere to store these for template-based agents, which have no `nodes[]` to hold a prompt.)
- [x] 2.2 Update `src/mocks/agents.mock.ts` fixtures to include at least one `draft` agent with a `base_template_id`.
- [x] 2.3 Update `AgentService` (`src/app/core/services/agent.service.ts`) status-related logic if it exhaustively switches over `active`/`inactive` only.

## 3. Static Agent Catalog

- [x] 3.1 Create `src/app/core/models/agent-template.model.ts`: `AgentTemplate { template_id, name, description, default_greeting, default_prompt, default_behavior, referral_bonus_eligible: boolean }`.
- [x] 3.2 Create `src/mocks/agent-templates.mock.ts` with the 5 fixed templates (Real Estate Sales — `referral_bonus_eligible: true`; Survey; Contact Centre; Alerting; General — all others `false`).
- [x] 3.3 Create `src/app/core/services/agent-template.service.ts`: `getTemplates(): Observable<AgentTemplate[]>` via `of(...).pipe(delay(300))`, matching `AgentService`'s convention.

## 4. Shared Confirm Dialog

- [x] 4.1 Promote `.modal-overlay`, `.modal`, `.modal-actions` from `dashboard.component.css` into `styles/globals.css` (they already use theme tokens, just mis-scoped today).
- [x] 4.2 Create `src/app/shared/confirm-dialog/confirm-dialog.component.ts/.html/.css` (standalone): takes a title, message, and confirm-label input; emits confirmed/cancelled (or exposes an `open()` method returning an `Observable<boolean>`), built on the promoted global modal classes. (Implemented as a `ConfirmDialogService` + single mounted `<app-confirm-dialog/>` in `app.component.ts`, mirroring the existing `ToastService`/`<app-toast/>` pattern.)
- [x] 4.3 Refactor `dashboard.component.ts`'s existing `deleteTarget()`/delete-confirmation flow onto the new shared component, removing the now-duplicated inline markup — this is the 3rd usage (delete, toggle, Go Live), so it's worth consolidating now rather than after.

## 5. Nav Shell

- [x] 5.1 Create `src/app/shared/nav-shell/nav-shell.component.ts/.html/.css` (standalone) replacing `AppShellComponent` as the app-level wrapper: right-edge icon rail that expands to a labeled flyout on `mouseenter`/collapses on `mouseleave`, with a `(hover: none)` media-query fallback that toggles on tap/click instead. (Implemented via pure-CSS `:hover` gated by `(hover: hover) and (min-width: 768px)`, plus a `.nav-rail-expanded` class toggled by a handle button click for touch/narrow — no JS mouseenter/mouseleave needed.)
- [x] 5.2 Add nav entries for Dashboard and Playground (Monitor Agents entry added in a later phase; leave a straightforward place to add it).
- [x] 5.3 Mark the active destination in both collapsed and expanded states using `routerLinkActive`.
- [x] 5.4 Add a persistent top-right theme toggle control (moved out of the old header, using the existing `ThemeService`).
- [x] 5.5 Add the hexagon avatar (CSS `clip-path`) showing the first letter of `AuthService.session().email`; hover expands to a panel with the full email and a "Log out" action wired to `AuthService.logout()` + navigate to `/login`.
- [x] 5.6 Update `app.component.ts` to render `NavShellComponent` instead of `AppShellComponent` when authenticated (keep the existing conditional shell-vs-bare-outlet split for `/login`).
- [x] 5.7 Leave `src/app/shared/app-shell/**` in place but unused by `app.component.ts`, in case it's needed for reference; do not delete `features/agent-builder/**` routes or components.
- [x] 5.8 Below the `sm` breakpoint (`--bp-sm`, 768px per `variables.css`), keep the rail icon-only by default per the updated `theming` Responsive Breakpoints requirement (this is the same condition as the `(hover: none)` fallback in 5.1 for touch devices, but must also hold for a narrow desktop window). (Same `min-width: 768px` media query condition used for both the rail and the avatar panel.)

## 6. Playground Feature

- [x] 6.1 Scaffold `src/app/features/playground/template-picker/template-picker.component.ts/.html/.css` — lists catalog templates as cards; selecting one navigates to `/playground/new/<template_id>` and initializes a new agent from that template's defaults with `enable_voice: true`. (Used a path segment instead of the suggested `?template=` query param — cleaner route separation between the picker and the editor; both routes still resolve under `/playground/new`.)
- [x] 6.2 Scaffold `src/app/features/playground/playground-editor/playground-editor.component.ts/.html/.css` — form fields for name, greeting, prompt, behavior; each field has a per-field "Reset" action restoring the template default, plus an agent-level "Reset to default" action. Also added a "Cancel" action (missing from the initial pass) that navigates back to `/dashboard` for an existing agent or `/playground/new` for an unsaved new one, discarding in-progress edits without saving.
- [x] 6.3 Implement fallback-to-default logic: saving with a blank name/greeting/prompt substitutes the template's default value rather than persisting an empty string.
- [x] 6.4 Implement Save (creates/updates the agent as `draft` via mock API, same POST/PATCH convention as `AgentService`).
- [x] 6.5 Implement "Go Live": clicking it opens the shared confirm dialog; only on confirmation does it call the mock API transitioning status to `active`. Cancelling leaves the agent `draft` with no API call.
- [x] 6.6 Scaffold `src/app/features/playground/drafted-list/drafted-list.component.ts/.html/.css` showing all `draft`-status agents with template name and last-modified time, separate from the main Dashboard list.
- [x] 6.7 Wire template-picker → editor → drafted-list into a `/playground` parent route with child routes (`new`, `new/:templateId`, `:id`, `drafted`).

## 7. Dashboard Integration

- [x] 7.1 Update `dashboard.component.html`/`.ts` to render a "Draft" badge and the originating template name for agents with `status: 'draft'`; extend the status filter tabs (All/Active/Inactive) to include Draft, including its count badge.
- [x] 7.2 Change "Create Agent" button navigation target from `/agents/new` to `/playground/new`.
- [x] 7.3 Change agent card / "Edit" click navigation target from `/agents/:id` to `/playground/:id`.
- [x] 7.4 Hide the active/inactive quick-toggle switch on `draft`-status agent cards; show an "Open in Playground" action in its place instead.
- [x] 7.5 Wire the active/inactive quick-toggle through the shared confirm dialog: clicking it opens a confirmation naming the target state; only on confirmation does the existing optimistic mock PATCH + UI update fire. Cancelling makes no API call and leaves status unchanged.

## 8. Routing

- [x] 8.1 Add `/playground` route group to `src/app/app.routes.ts` (guarded by `authGuard` like the rest of the protected routes) with children for template picker, editor, and drafted list.
- [x] 8.2 Leave `/agents/new` and `/agents/:id` routes in place, still guarded, still functional, just unlinked from Dashboard and nav-shell.

## 9. Verification

- [x] 9.1 Manually verify: Dashboard → Create Agent → template picker → select template → editor pre-filled with defaults → edit a field → Save → agent appears in Dashboard as Draft with correct template name.
- [x] 9.2 Manually verify: clicking Go Live opens a confirmation modal; cancelling leaves the agent Draft; confirming transitions it to Active on the Dashboard. Per-field Reset and whole-agent Reset to default both work as specified.
- [x] 9.3 Manually verify: the Dashboard's active/inactive quick-toggle opens a confirmation modal before applying, in both directions; cancelling leaves status unchanged; the existing delete confirmation still works after being refactored onto the shared component.
- [x] 9.4 Manually verify: nav-shell hover-expands/collapses correctly, active route highlighted, theme toggle and hexagon avatar/logout work from any screen, in both light and dark themes.
- [x] 9.5 Manually verify: `/agents/new` and `/agents/:id` (old Agent Builder) still load and function when navigated to directly by URL.
- [x] 9.6 Run `ng build` to confirm no regressions; check browser console for errors during the manual verification pass.
