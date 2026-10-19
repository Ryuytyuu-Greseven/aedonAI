## Why

Two Phase 2 items remain from `requirements/Main_Flow.txt`: item 16 describes a live preview/test-call step that must happen before an agent can go live ("once agent is built, give the customer to test it in live... if customer is satisfied, will launch the agent to live"), and item 22 requires a referral bonus amount + currency for the Real Estate Sales template specifically. Both are additive to the shipped Playground, but the preview requirement changes an already-shipped behavior (direct one-click "Go Live"), so it needs to be handled as a spec modification rather than a bolt-on.

## What Changes

- Add a "Preview" action on a `draft` agent that simulates invoking the agent over a call via a mock API call, returning a simulated response/transcript.
- **BREAKING**: "Go Live" is no longer reachable directly from a fresh draft — it is only enabled after a successful Preview in the current editing session. Editing any customization field after a successful preview invalidates it, requiring a new Preview before Go Live re-enables (otherwise a stale preview could reflect since-changed behavior).
- Add a referral bonus section to the Playground editor, shown only when the agent's template is referral-bonus-eligible (currently only Real Estate Sales, per the `static-agent-catalog`'s `referral_bonus_eligible` flag): a bonus amount field and a currency selector (USD, INR, AED, THB, GBP, EUR).

## Capabilities

### New Capabilities
- `agent-preview-call`: Simulated preview/test call for a draft agent, gating the Go Live transition on a successful preview.
- `referral-bonus-config`: Referral bonus amount + currency, shown only for referral-bonus-eligible templates.

### Modified Capabilities
- `playground`: the "Draft and Live State" requirement changes — "Go Live" becomes conditional on a successful Preview in the current session rather than being unconditionally available on any `draft` agent.

## Impact

- **Affected code**: `src/app/core/models/agent.model.ts` (add `referral_bonus?: { amount: number; currency: string }`), `src/app/features/playground/playground-editor/*` (Preview action + gating logic, Referral Bonus section conditional on template eligibility), `src/app/core/services/agent.service.ts` (mock `previewCall` method).
- **Untouched**: the Go Live confirmation modal mechanics and the mock PATCH-to-active call itself — only the condition for enabling the action changes.
- **Dependencies**: none new; still mock-only (no real telephony invocation).
