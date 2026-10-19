## 1. Model Changes

- [x] 1.1 Extend `Tool` in `src/app/core/models/agent.model.ts`: add `kind?: 'custom' | 'api_webhook' | 'sms' | 'whatsapp' | 'email'` (default/undefined treated as `'custom'`) and `destinationConfig?: { url?: string; recipient?: string }`.
- [x] 1.2 Add a helper in `agent.model.ts` (or a new `export-destination.util.ts`) to build/read a destination `Tool` from `{ kind, url?, recipient?, description? }`, keeping construction logic in one place. (Added `createDestinationTool()` and `isDestinationTool()`.)

## 2. Export Destinations Feature

- [x] 2.1 Create `src/app/features/playground/export-destinations/export-destinations.component.ts/.html/.css` (standalone): lists current destinations from `agent.tools.filter(t => t.kind && t.kind !== 'custom')`; form to add a destination (type selector + the 1-2 relevant fields); edit and remove actions per destination.
- [x] 2.2 Wire required-field validation per type (`api_webhook` needs `url` + `description`; `sms`/`whatsapp`/`email` need `recipient`).
- [x] 2.3 Embed the component as a section within `playground-editor.component.html`, operating on the same in-memory agent/tools the editor already saves via `AgentService.updateAgent`/`createAgent`. (Added a `tools` signal to the editor, wired via `[tools]`/`(toolsChange)`, included in the save payload alongside the other fields — persisted on the same Save click, not a separate round trip.)

## 3. Agent Clone

- [x] 3.1 Add `cloneAgent(id: string): Observable<Agent>` to `AgentService`: finds the source agent, computes the clone name (strip existing `" Clone <n>"` suffix, find max `<n>` among same-base-name agents, use `n + 1`), creates a new agent with a fresh id, `status: 'draft'`, and copies `greeting`/`prompt`/`behavior`/`enable_voice`/`tools`/`base_template_id`.
- [x] 3.2 Add a "Clone" quick action to `dashboard.component.ts/.html`: calls `cloneAgent`, appends the result to the list, shows a success toast; available regardless of the source agent's status.
- [x] 3.3 Add a "Clone" action to the Playground editor toolbar (`playground-editor.component.ts/.html`) for already-saved agents: calls `cloneAgent`, then navigates to `/playground/:newId`.

## 4. Verification

- [x] 4.1 Manually verify: add an API webhook destination (url + description) and an SMS destination (recipient) to an agent, confirm both appear in the Export Destinations list, edit one, remove the other. Also confirmed destinations persist across SPA navigation away and back (not just in-memory during the same view).
- [x] 4.2 Manually verify: cloning "Weekend Survey Line" from the Dashboard produces "Weekend Survey Line Clone 1" as a new Draft card; cloning it again produces "Weekend Survey Line Clone 2"; cloning "Weekend Survey Line Clone 2" produces "Weekend Survey Line Clone 3" (not a doubled suffix).
- [x] 4.3 Manually verify: cloning an `active` agent produces a `draft` clone; cloning from inside the Playground editor navigates to the new clone. **Bug found and fixed during verification**: `PlaygroundEditorComponent` read route params only once from `route.snapshot` in `ngOnInit`, so navigating from one `:id` to another `:id` (as Clone-from-editor does) reused the same component instance without reloading — the form kept showing the old agent. Fixed by subscribing to `route.paramMap` (via `takeUntilDestroyed`) and re-running the load on every param change; this also fixes the same latent issue for any future same-route agent-to-agent navigation.
- [x] 4.4 Confirm the existing Tools Management tab (Agent Builder) still only ever creates/shows `kind: 'custom'` tools and is otherwise unaffected.
- [x] 4.5 Run `ng build` to confirm no regressions; check browser console for errors during the manual verification pass.
