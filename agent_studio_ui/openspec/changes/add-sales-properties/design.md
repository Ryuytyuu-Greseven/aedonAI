## Context

The Playground editor's sidebar already has one per-agent management widget — Knowledge Base (`app-agent-knowledge-bases`), rendered as a `.card.section-card` with an icon+title header, always visible for every template. Properties needs to look and feel the same, but with two real differences:

1. **Template-gated.** Only `real_estate_sales` agents get it. The editor already resolves the current template into a `template` signal for both new-from-template and existing-agent flows (`loadExistingAgent()` fetches it via `agent.base_template_id`), so gating on `template()?.template_id === 'real_estate_sales'` covers both cases with no new plumbing. Confirmed live against the real backend that this template's real id is `real_estate_sales` — the local `agent-templates.mock.ts` file has a stale, different id (`template-real-estate-sales`) and is unused dead code (nothing in `src/app` imports it); not relied on here.
2. **Not draft state.** Knowledge Base links are staged locally (`knowledgeBaseIds` signal) and only persisted when the whole agent is saved. Properties can't work that way — each one is created/edited/deleted directly against its own real endpoint (`sales.md`), and doing so requires a real `agentId` that only exists once the agent has been saved at least once. So Properties owns its own full lifecycle independently of the agent's save flow, and needs to handle "agent not saved yet" as a first-class state.

The real API is also simpler than first assumed: a property is just `{ id, companyId, agentId, name, description }` — no `price`/`sqft`/`address`/`customFields`. Confirmed directly with the user: everything beyond the name goes into `description` as free text.

## Goals / Non-Goals

**Goals:**
- Let an admin/agent-owner add, view, edit, and delete Properties for a `real_estate_sales` agent, from the Playground editor sidebar.
- Match the Knowledge Base section's visual language (card, header, compact list) closely enough that it reads as part of the same family of sidebar widgets.
- Show the section (disabled, with an explanation) even before the agent has been saved, rather than hiding it outright — so it's discoverable, not something the admin has to stumble into by saving first.
- Treat delete as genuinely irreversible in the UI (confirm dialog, clear copy) since the backend has no undo.

**Non-Goals:**
- Any structured fields beyond `name`/`description` (no price/sqft/address inputs, no custom-fields editor) — the real API doesn't have them.
- Showing Properties anywhere outside the Playground editor sidebar (no standalone Properties page, no surfacing on the agent list/dashboard).
- Any change to how the agent itself is created/saved, or to Knowledge Base/Tools/MCP Servers.
- Bulk operations (bulk delete, import/export).

## Decisions

**1. New `Property` model matches the API's minimal shape exactly — no speculative fields.**
```ts
interface Property { id: string; agent_id: string; name: string; description: string | null; created_at: string; updated_at: string; }
interface CreatePropertyInput { name: string; description?: string; }
interface UpdatePropertyInput { name?: string; description?: string; }
```
A `property-mapper.ts` (wire `ApiProperty` → `fromApiProperty`, `toCreatePropertyRequest`/`toUpdatePropertyRequest`) follows the exact pattern already used for `knowledge-base-mapper.ts`/`phone-number-mapper.ts` — wire casing (`companyId`, `agentId`) stays as documented, normalized to this app's snake_case model convention (matching `Agent.base_template_id`/`agent_name`) on the way in.

**2. `PropertyService` wraps `ApiService`'s 5 new methods 1:1** (`createProperty`, `getProperties`, `getProperty`, `updateProperty`, `deleteProperty`) — mirrors `KnowledgeBaseService`/`AdminService`'s thin-wrapper pattern. No local caching/signal store beyond what the component itself holds, since nothing else in the app needs Properties data (unlike `MetaIntegrationService.pages`, which is shared across Admin Settings and the Leads tab).

**3. `AgentPropertiesComponent` owns its full lifecycle, keyed off a nullable `agentId` input.**
```ts
@Input({ required: true }) agentId: string | null = null;
```
- `agentId === null` → disabled state: the "Add Property" button and any existing list are not shown; instead a single disabled-styled notice: "Save this agent first to add properties." (Per explicit direction: visible-but-disabled, not hidden entirely.)
- `agentId` set → fetches `getProperties(agentId)` on init/change, renders the list, enables Add/Edit/Delete.
- If a user adds Properties, then saves the agent triggering a route/id change... this doesn't actually happen — `agentId` is stable once assigned (`settleCreated()` sets it once via `Location.replaceState`, not a fresh navigation), so the component only ever transitions `null → <id>` once, never back, and never to a different id without a full page reload. `ngOnChanges` handles the transition cleanly either way.

**4. List + inline Add form + per-row Edit/Delete, matching Knowledge Base's compact-card-list visual style — not its enable/disable interaction model.**
Knowledge Base entries toggle disabled/enabled (soft state); Properties don't have that concept (hard delete only). So each property row gets:
- Name + a truncated/collapsed description preview.
- "Edit" — opens the same add/edit form inline (or in the existing `.modal-overlay`/`.modal.card` pattern — reusing the sales-agent-list modal convention, since an edit form with two fields is closer to that than to Knowledge Base's inline-list-item pattern), pre-filled, `PATCH`es on save.
- "Delete" — `ConfirmDialogService` confirm ("This permanently deletes '<name>'. This cannot be undone.") before calling `DELETE`.
- "Add Property" button opens the same form empty, `POST`s on save.
- Alternative considered: full inline edit (no modal), matching Knowledge Base's add-file/add-url inline forms exactly. Rejected — Knowledge Base's inline forms are single-field-ish (url+label); a name+multiline-description edit form reads cleaner as the existing small modal pattern already used elsewhere (`sales-agent-list.component.html`'s edit-name/reset-password modals).

**5. Sidebar placement: new section directly below the existing Knowledge Base section, same `<aside>`.**
```html
@if (template()?.template_id === 'real_estate_sales') {
  <div class="card section-card">
    <div class="card-header section-header"><i class="fa-solid fa-building" aria-hidden="true"></i> Properties</div>
    <div class="card-body"><app-agent-properties [agentId]="agentId()" /></div>
  </div>
}
```
Placed after Knowledge Base so the sidebar's default (template-agnostic) content stays visually first, with the template-specific addition appended below it — least disruptive to the existing layout for every other template.

## Risks / Trade-offs

- [Stale mock template id (`template-real-estate-sales`) could mislead future work] → Confirmed live against the real backend that the actual id is `real_estate_sales`; this design and its spec/tasks use that value explicitly and call out the mismatch, but the dead mock file itself isn't cleaned up here (out of scope) — flagged as an Open Question.
- [Deleting a property is immediate and irreversible] → Confirm dialog with explicit "cannot be undone" copy is the only safeguard, matching the backend's own hard-delete-only contract; no soft-delete/undo is possible to add here without a backend change.
- [Properties for a not-yet-saved agent are invisible until Save] → Mitigated by showing the section disabled-with-explanation rather than hiding it, per explicit direction — the admin knows the feature exists and why it's unavailable yet, rather than wondering where it went.

## Migration Plan

Purely additive — a new model/service/component plus one new conditional block in the Playground editor's existing sidebar. No changes to existing Properties-unrelated code paths. Safe to revert as a unit.

## Open Questions

- Should `src/mocks/agent-templates.mock.ts` (stale, unused, wrong template id) be deleted in a follow-up cleanup? Not touched here since nothing references it today.
- Real backend currently only returns one template (`real_estate_sales`) per the live Template Picker check — worth confirming whether more templates are expected soon, since this feature is deliberately template-specific and would need the same live-id-verification step for any future template-gated feature.
