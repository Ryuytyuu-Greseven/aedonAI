## 1. Model Changes

- [x] 1.1 Add `referral_bonus?: { amount: number; currency: string }` to `Agent` in `src/app/core/models/agent.model.ts`.
- [x] 1.2 Add a `CURRENCIES` constant (`['USD', 'INR', 'AED', 'THB', 'GBP', 'EUR']`) alongside the model, for reuse in the currency selector.

## 2. Preview Call

- [x] 2.1 Add `previewCall(id: string): Observable<{ transcript: string }>` to `AgentService`: mock `of(...).pipe(delay(300))` returning a canned simulated transcript referencing the agent's greeting/prompt.
- [x] 2.2 In `PlaygroundEditorComponent`, add a `previewPassed` signal and a `preview()` method: calls `save()`'s underlying persist logic, then `previewCall`, sets `previewPassed` to `true` on success, and stores the returned transcript in a signal for display. (Refactored `save()`'s persist logic into a shared `persist()`/`settleCreated()` so both Save and Preview reuse it. Also fixed a race: `loadFromParams` now skips resetting local state when the route's `id` already matches the currently-loaded agent, so Preview's auto-save-then-navigate for a brand-new agent doesn't get its own `previewPassed`/transcript wiped by the route-driven reload.)
- [x] 2.3 Subscribe to `form.valueChanges` and to the `tools` signal (e.g. via an `effect`) to reset `previewPassed` to `false` whenever either changes after being set `true`.
- [x] 2.4 Update the editor template: add a "Preview" button (draft agents only), a result panel showing the simulated transcript when present, and gate the existing "Go Live" button on `previewPassed()` (disabled/hidden when `false`).

## 3. Referral Bonus Config

- [x] 3.1 Add a Referral Bonus section to `playground-editor.component.html`, shown only when `template()?.referral_bonus_eligible` is `true`: an amount number input and a currency `<select>` populated from `CURRENCIES`.
- [x] 3.2 Wire the section's fields into the editor's save payload as `referral_bonus: { amount, currency }` only when the template is eligible; omit the field entirely (not just hide it) when not eligible.
- [x] 3.3 Pre-fill the section from `agent.referral_bonus` when editing an existing eligible agent.

## 4. Verification

- [x] 4.1 Manually verify: on a fresh draft agent, "Go Live" is disabled/hidden until "Preview" is clicked; after a successful preview, "Go Live" becomes available and its confirm-modal flow (confirm/cancel) still works as before.
- [x] 4.2 Manually verify: after a successful preview, editing any field (or an export destination) makes "Go Live" unavailable again until Preview is re-run.
- [x] 4.3 Manually verify: creating a Real Estate Sales agent shows the Referral Bonus section; creating a Survey/Contact Centre/Alerting/General agent does not.
- [x] 4.4 Manually verify: setting a referral bonus amount + currency, saving, then reopening the agent shows the persisted value; switching currency preserves the amount.
- [x] 4.5 Run `ng build` to confirm no regressions; check browser console for errors during the manual verification pass.

**Bug found and fixed during verification (beyond the listed tasks)**: Previewing a brand-new (never-saved) agent auto-saves and navigates from `/playground/new/:templateId` to `/playground/:id` — but those are different route configs, so Angular destroys and recreates `PlaygroundEditorComponent` on that transition (unlike the same-route `:id → :id` reuse case fixed in `export-clone-agents`). The just-set `previewPassed`/transcript were being set on the old, about-to-be-destroyed instance and lost. Fixed by having the "settle a newly created agent" step update the URL via `Location.replaceState` instead of `Router.navigate`, so this specific transition no longer goes through the Router (and thus never triggers component recreation) — the running instance and its preview state stay intact. `Router.navigate` is still used everywhere navigation to a genuinely different agent is intended (Clone, Cancel).
