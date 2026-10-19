## Why

`requirements/Main_Flow.txt` items 12–13 and 18 describe two Playground capabilities not yet built: letting a customer wire their agent's collected call data to an outbound destination (API webhook, SMS, WhatsApp, or email), and letting them clone an existing agent (draft or live) instead of starting from a template every time. Both are additive to the Playground shipped in `playground-mode` and don't touch the Draft/Live state machine, so they can ship independently of the preview-call and referral-bonus work.

## What Changes

- Add an "Export Destinations" section to the Playground editor where the user can add/edit/remove destinations of type API webhook (URL + description), SMS, WhatsApp, or Email (recipient contact for the agent owner).
- Each destination is stored as an entry in the agent's existing `tools` array (reusing the `Tool` model/JSON schema) rather than introducing a parallel data structure, since `requirements/Main_Flow.txt` item 12 explicitly frames a destination as "a tool with tool description."
- Add a "Clone" action, available on Dashboard agent cards and inside the Playground editor toolbar, for any agent regardless of status (`draft`, `active`, or `inactive`) or origin. The clone is named `<agent_name> Clone <n>`, always created as `draft`, and copies all customization fields and destinations.

## Capabilities

### New Capabilities
- `export-destinations`: Configuring API/SMS/WhatsApp/Email data-export destinations on a Playground agent, stored as specialized entries in `Agent.tools`.
- `agent-clone`: Cloning an existing agent (from Dashboard or Playground) into a new draft with an auto-incremented "Clone" name.

### Modified Capabilities
- `dashboard`: adds a "Clone Agent (Quick Action)" requirement to the agent card actions.
- `playground`: adds requirements for the Export Destinations section and the in-editor Clone action.

## Impact

- **Affected code**: `src/app/core/models/agent.model.ts` (extend `Tool` with an optional destination kind/config), `src/app/features/playground/playground-editor/*` (new Export Destinations section + Clone button), `src/app/features/dashboard/dashboard.component.*` (Clone quick action), `src/app/core/services/agent.service.ts` (clone helper).
- **Untouched**: `tools-management` capability and its free-form Tool Parameter Schema Builder — export destinations are a separate, purpose-built UI that happens to share the same `Tool[]` storage, not a reuse of that component.
- **Dependencies**: none new; still mock-only (no real API/SMS/WhatsApp/email dispatch — that remains simulated, per the existing mock-API convention).
