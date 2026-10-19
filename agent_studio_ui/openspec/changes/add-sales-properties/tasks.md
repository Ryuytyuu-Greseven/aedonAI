## 1. Model & mapper

- [x] 1.1 Added `src/app/core/models/property.model.ts`: `Property`, `CreatePropertyInput`, `UpdatePropertyInput`.
- [x] 1.2 Added `src/app/core/http/property-mapper.ts`: `ApiProperty`, `fromApiProperty()`, `toCreatePropertyRequest()`, `toUpdatePropertyRequest()`.

## 2. API layer

- [x] 2.1 Added `ApiEndpoints.salesProperties` (`list`, `byId`) to `api-config.ts`.
- [x] 2.2 Added to `ApiService`: `createProperty`, `getProperties` (query param via `HttpService`'s `params`), `getProperty`, `updateProperty`, `deleteProperty`.
- [x] 2.3 Added `src/app/core/services/property.service.ts` wrapping the 5 methods 1:1.

## 3. `AgentPropertiesComponent`

- [x] 3.1 Scaffolded `src/app/features/playground/agent-properties/agent-properties.component.{ts,html,css}`, `@Input({ required: true }) agentId: string | null = null`.
- [x] 3.2 `agentId === null` → disabled notice ("Save this agent first to add properties.").
- [x] 3.3 `agentId` set → fetches and renders the list with a loading skeleton state.
- [x] 3.4 Empty state ("No properties yet.") for zero results.
- [x] 3.5 "Add Property" opens a `.modal-overlay`/`.modal.card` form (name + description); creates via `PropertyService.createProperty()`, prepends on success, toast, closes modal.
- [x] 3.6 "Edit" per row opens the same modal pre-filled; updates via `PropertyService.updateProperty()`, replaces the row, toast.
- [x] 3.7 "Delete" per row confirms via `ConfirmDialogService` with explicit "cannot be undone" copy; deletes via `PropertyService.deleteProperty()`, removes the row, toast. Cancel sends no request.

## 4. Wire into Playground editor sidebar

- [x] 4.1 Imported `AgentPropertiesComponent` into `playground-editor.component.ts`'s standalone `imports`; added `isRealEstateSales` computed signal (`template()?.template_id === 'real_estate_sales'`).
- [x] 4.2 Added the conditional Properties `.card.section-card` directly after Knowledge Base in `playground-editor.component.html`; added `gap: 20px` flex layout to `.playground-editor-side` (previously had only one child card, no spacing rule existed).

## 5. Backend contract docs

- [x] 5.1 Added `backend-openspec/specs/sales-properties/spec.md` documenting the real, confirmed contract from `sales.md`.

## 6. Verification

- [x] 6.1 Build clean (`ng build`), type-check clean (`tsc --noEmit`).
- [x] 6.2 Manually verified: a brand-new, unsaved `real_estate_sales` agent (via `/playground/new/real_estate_sales`) shows the Properties section disabled with the "save first" note; confirmed via network log that no `/sales/properties` request fired.
- [x] 6.3 Manually verified: saving the agent (real `POST /api/agents`) transitions Properties to interactive; Add Property fired a real `POST /api/sales/properties` (`201`), the created property appeared in the list with a success toast.
- [x] 6.4 Manually verified: Edit fired a real `PATCH /api/sales/properties/:id` (`200`), updated in place; Delete showed the confirm dialog with "cannot be undone" copy, and confirming fired a real `DELETE` (`204`), removing the row with a success toast.
- [x] 6.5 Manually verified: an existing agent on a different template ("E-Commerce Customer Service") shows no Properties section at all.
- [x] 6.6 No console errors throughout. Cleaned up the test agent created for 6.2/6.3 afterward via the Dashboard's own delete action (confirmed "Agent deleted" toast) — no leftover test data.

### Note

Discovered live that this template is already in real use — two other agents ("RajPushpa The Grand", live, and "Real Estate Sales Clone 1", draft) already carry the `real_estate_sales` template, so this feature is immediately usable beyond just the template-picker flow, not only a hypothetical future case.
