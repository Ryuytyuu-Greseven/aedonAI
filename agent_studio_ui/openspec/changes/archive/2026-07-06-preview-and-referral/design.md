## Context

The Playground editor (`playground-editor.component.ts`) currently ships a direct "Go Live" action on any `draft` agent, gated only by a confirmation modal (`ConfirmDialogService`, shared across the app). `requirements/Main_Flow.txt` item 16 describes an additional gate: the customer must preview/test the agent over a simulated call and be satisfied before launching. This change inserts that gate without touching the confirmation-modal mechanics already built and verified in `playground-mode`.

## Goals / Non-Goals

**Goals:**
- Require a successful Preview in the current editing session before "Go Live" is reachable.
- Invalidate a passed preview when the user changes anything afterward (form fields or export destinations/tools), so Go Live can't fire against stale, unpreviewed behavior.
- Show the referral bonus section only for templates flagged `referral_bonus_eligible` (currently Real Estate Sales only), leaving every other template's editor unchanged.

**Non-Goals:**
- No real telephony invocation — Preview is a mock API call returning a canned simulated transcript, same convention as every other mock service in the app.
- No persistence of "preview passed" state across sessions — closing and reopening the editor always requires a fresh preview before Go Live, even for a previously-previewed draft. Treated as a per-editing-session gate, not an agent property.
- No validation/formatting of the referral bonus amount beyond "is a positive number" — currency conversion, payout logic, etc. are out of scope.

## Decisions

- **Preview also saves.** Per item 16 ("we will draft the changes and store in backend by an api call... and the agent gets invoked"), clicking "Preview" first persists the current form state exactly like "Save" does (create if new, update if existing), then calls a new mock `AgentService.previewCall(id): Observable<{ transcript: string }>`. This avoids a separate "unsaved preview" state to reason about — what gets previewed is always what's actually stored.
- **"Satisfied" is implicit in clicking Go Live; "not satisfied" is implicit in continuing to edit.** No separate confirmation toggle is added beyond the existing Go Live confirm modal — a successful preview simply unlocks the Go Live button, and the modal (already built) is the final confirmation.
- **`previewPassed` is a plain component signal, reset by any subsequent change.** Implemented by subscribing to `form.valueChanges` and the `tools` signal; either resets `previewPassed` to `false`. This is intentionally coarse (any keystroke invalidates) rather than diffing meaningful vs. cosmetic changes, since the mock preview doesn't actually execute real behavior anyway — the point is to model the workflow shape, not build a precise dirty-checker.
- **Referral bonus lives on `Agent` as `referral_bonus?: { amount: number; currency: string }`**, populated only when `template.referral_bonus_eligible` is true; omitted from the save payload otherwise (not just hidden in the UI), so a non-Sales agent's JSON never carries a stray referral bonus object.
- **Currency list is a fixed array** (`USD`, `INR`, `AED`, `THB`, `GBP`, `EUR`) matching `requirements/Main_Flow.txt` item 22 literally — no locale/currency library added for six fixed options.

## Risks / Trade-offs

- [Any field edit invalidating the preview could feel heavy-handed if a user fixes a typo after previewing] → Acceptable trade-off given this is a mock system modeling the requirement's shape ("if customer wants to edit again", i.e. edits always mean re-preview); a real implementation might diff more precisely, out of scope here.
- [Preview auto-saving could surprise a user who clicks Preview expecting a read-only trial] → Mitigated by labeling the button and its result panel clearly (e.g., "Preview (saves draft)") during implementation; behavior matches the literal requirement text.
