## Why

Real Estate Sales agents need property listings the agent can reference on calls, but there's nowhere in the app to manage them today. The backend now has a real, confirmed Sales Properties API (`sales.md`) — a property belongs to exactly one agent, so this is naturally scoped to that agent's own editor rather than a shared/global list.

## What Changes

- Add a "Properties" section to the Playground editor's sidebar, visually matching the existing "Knowledge Base" section, but **only for agents built from the `real_estate_sales` template** (confirmed live against the real backend — not the stale `template-real-estate-sales` id in the local mock file). Hidden entirely for every other template.
- Full CRUD against the real API: list, add, edit, delete — a property has just two fields, `name` (required) and `description` (optional free text; per the real API's current shape, price/sqft/address/etc. all live inside `description` as plain text, there are no dedicated fields for them).
- Deleting a property is a hard delete (no undo, confirmed via the real API contract) — gated behind a confirm dialog, consistent with how this app treats other irreversible actions.
- A property requires a real `agentId` to exist server-side — for a brand-new agent draft that hasn't been saved yet, the Properties section renders visibly but disabled, with an inline note explaining the agent needs to be saved first (per explicit user direction).

## Capabilities

### New Capabilities
- `sales-properties`: CRUD for an agent's property listings (Real Estate Sales template only) — list, add, edit, delete, each immediately persisted via the real API (not batched into the agent's own Save).

### Modified Capabilities
- `playground`: the editor sidebar conditionally gains a Properties section alongside the existing Knowledge Base section, shown only when the loaded/selected template is `real_estate_sales`.

## Impact

- Frontend: `src/app/core/models/property.model.ts`, `src/app/core/http/property-mapper.ts`, `src/app/core/http/api-config.ts` (+`salesProperties` endpoint group), `src/app/core/http/api.service.ts` (+5 methods), `src/app/core/services/property.service.ts`, new `src/app/features/playground/agent-properties/*` component, `src/app/features/playground/playground-editor/playground-editor.component.html` (new conditional sidebar section).
- Docs: `backend-openspec/specs/sales-properties/spec.md` (new — the real, confirmed contract from `sales.md`); `openspec/specs/sales-properties/spec.md`, delta spec for `playground`.
- No changes to how agents themselves are created/saved — Properties are fully independent, real-time CRUD against their own endpoints, not part of the agent draft/save payload.
