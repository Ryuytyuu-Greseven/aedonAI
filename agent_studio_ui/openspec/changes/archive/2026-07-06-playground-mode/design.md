## Context

Today `app.component.ts` always wraps routed content in `AppShellComponent`, a top horizontal header (logo left, tab nav center, theme toggle + logout right). All screens are built on a hand-rolled CSS variable + utility-class system (`src/styles/variables.css`, `src/styles/globals.css`) with `ThemeService` toggling `[data-theme]`. The existing Agent Builder (`agent-builder`, `flow-editor`, `node-management`, `tools-management`, `version-history`, `testing-console` capabilities) is a fully working free-form graph editor reachable at `/agents/new` and `/agents/:id`.

`requirements/Main_Flow.txt` asks for a different creation model for general customers: a fixed catalog of 5 in-house agents, customized through form fields only (no graph editing), plus a structurally different nav (right-edge hover flyout, hexagon avatar, relocated theme toggle). Per product decision, this Playground becomes the only active creation path; the free-form builder is not deleted, just unlinked from navigation, so it can be revived for a future fully-custom tier without rework.

## Goals / Non-Goals

**Goals:**
- Ship a new nav shell (`nav-shell`) that structurally replaces the top header without touching `ThemeService`'s public API or the existing dark/light token system.
- Ship a static template catalog (`static-agent-catalog`) as mock data, matching the existing `mocks/*.mock.ts` convention.
- Ship the Playground (`playground`) creation/editing flow: template pick → customize → reset-to-default → Draft/Live, using the same mock-`Observable`-with-delay convention as `AgentService`.
- Keep `agent-builder` and its child capabilities completely unmodified — they must still build, still be reachable by URL, and still pass as-is.
- Extend, not replace, the existing dashboard: same component, same list, richer status enum and different navigation targets.

**Non-Goals:**
- No real node/flow customization for Playground agents (explicitly excluded by `requirements/Main_Flow.txt` item 10).
- No live telephony, no real report generation/delivery, no real SMS/WhatsApp/Email sending — all mocked (later phases per the roadmap).
- No multi-user/customer/tenant model — single implicit user, consistent with the rest of the app today.
- No Bootstrap adoption — FontAwesome (icons only) is added, but layout/components continue to use the existing global CSS system.

## Decisions

- **`nav-shell` is a new capability, not a `theming` change**, because it governs structural layout/interaction (hover-triggered flyout, avatar) rather than design tokens. `theming` gets a narrow MODIFIED requirement only for the toggle's required location, since that's the one theming-owned behavior the new shell affects.
- **Hover flyout implemented as a fixed-position off-canvas panel** triggered by `mouseenter`/`mouseleave` on a slim always-visible edge rail (icons only when collapsed, labels when expanded) — matches the "Edge browser favorites" reference exactly and avoids a click-to-toggle interaction the requirement doesn't ask for. Falls back to a tap-to-toggle on touch devices (hover doesn't exist there) — noted as an open question below.
- **Hexagon avatar** is a CSS `clip-path: polygon(...)` shape showing the first letter of the session's display name (falls back to the first letter of the `AuthService` session email, since there's no separate profile/name field yet). Hover expands to a small panel with email + logout — logout moves from the old header into this panel; nav-shell absorbs the app-shell's existing logout responsibility.
- **`static-agent-catalog` is data-only** (a mock service + fixture file), not a UI capability — `playground` is the sole consumer of the catalog. This mirrors how `flow-editor`/`node-management` consume `AgentService` data without owning it.
- **Agent model gets one additive field, `base_template_id?: string`**, rather than a broader `origin`/`type` split. Per product decision there is no dual-entity model right now; every agent today is template-based, so the field is simply absent for (currently nonexistent) non-template agents. This keeps the door open for a future custom-agent tier without a migration.
- **Draft vs Live is a status value (`draft`), not a separate list/entity.** `dashboard`'s existing Agent List requirement already renders `active`/`inactive`; adding `draft` to the same enum is the smallest change that satisfies "list drafted agents" without introducing a parallel data source. A dedicated Draft filter tab is added the same way `Active`/`Inactive` tabs already work.
- **Create Agent / Open Agent re-routing is additive at the routing layer**, not a rewrite of dashboard's rendering: `app.routes.ts` gains `/playground/new` and `/playground/:id`; `dashboard.component.ts`'s existing click handlers change their `router.navigate` targets. `agents/new` and `agents/:id` remain mounted and functional, just no longer linked to from the dashboard for template-based agents.
- **Export-destination "tools" are deferred to Phase 2** (`export-destinations` capability) — this change only needs the Playground shell and template customization to exist; Tools Management is reused later without modification here.
- **All status-changing confirmations (activate, deactivate, Go Live, and the existing agent delete) share one `ConfirmDialogComponent`**, rather than duplicating the inline `deleteTarget()`/`.modal-overlay` pattern currently local to `dashboard.component.ts`. The `.modal-overlay`/`.modal`/`.modal-actions` CSS is promoted from `dashboard.component.css` into `styles/globals.css` (it's already theme-token-driven, just mis-scoped) and `dashboard.component.ts`'s existing delete confirmation is refactored onto the shared component as part of this change, since it would otherwise be the 3rd copy of the same pattern. The component takes a title/message/confirm-label and returns a confirmed/cancelled result (e.g. via a small `open()` method returning an `Observable<boolean>` or emitting an output) — no new modal library, still built on existing global CSS.

## Risks / Trade-offs

- [Hover-only flyout is unusable on touch/tablet] → Mitigation: add a tap-to-toggle affordance behind a coarse-pointer media query; flagged as an open question rather than silently decided, since Main_Flow.txt doesn't address touch.
- [Two parallel creation UIs (`Agent Builder` dormant + `Playground` active) increase surface area for regressions if either is touched carelessly later] → Mitigation: no shared components between the two beyond `AgentService`/`Agent` model; changes to Playground must not touch `features/agent-builder/**`.
- [Expanding the dashboard status enum to include `draft` could surprise anything filtering strictly on `active`/`inactive`] → Mitigation: search for exhaustive status switches in `dashboard.component.ts` during implementation and update them alongside the enum; the quick-toggle is explicitly excluded from `draft` agents in the `dashboard` delta spec to prevent it bypassing the Playground's "Go Live" action.
- [Phase 1's "Go Live" is a single direct action, but `requirements/Main_Flow.txt` item 16 describes a preview/test-call step gating the draft→live transition] → This phase intentionally ships the simpler direct transition; Phase 2 (`agent-preview-call`) is expected to add a `MODIFIED` requirement on Playground's "Draft and Live State" to insert the preview step, not a brand-new independent requirement. Calling this out now so Phase 2 planning doesn't collide with what Phase 1 already normatively specifies.
- [Skipping Bootstrap is a judgment call, not something the user explicitly confirmed] → `requirements/Main_Flow.txt` item 5 only says "try to use bootstrap if required"; this design treats it as not required, to avoid a second competing CSS system. Flagged here so it's easy to revisit if the user disagrees.
- [`requirements/Main_Flow.txt` item 11 — "voice agents ... over the call in any country" — has no owning capability yet] → Country/calling-region configuration isn't addressed by any Phase 1–4 capability in the current roadmap. Likely belongs with real telephony integration (backend-heavy, out of frontend mock scope), but it should be tracked explicitly rather than silently dropped — needs a decision on which phase (or the backend-openspec track) owns it.

## Open Questions

- Exact list/wording of the 5 static templates' default prompts and greetings — Phase 1 tasks will draft reasonable placeholder copy per template category; content can be refined later without a spec change.
- Whether the Dashboard's default landing filter should be "Active" specifically (per item 6's literal wording) instead of today's "All" default — left unchanged in this phase pending explicit confirmation, since it's a behavior change beyond what was scoped.
