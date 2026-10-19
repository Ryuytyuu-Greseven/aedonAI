## 1. Data Model Migration

- [x] 1.1 Create `src/app/core/models/knowledge-base.model.ts` with `KnowledgeBaseEntryKind`, `KnowledgeBaseEntry`, `KnowledgeBase { id; name; entries; created_at; updated_at }`, and `knowledgeBaseEntryNameExists(entries, name, excludeId?)` / `knowledgeBaseNameExists(bases, name, excludeId?)` helpers
- [x] 1.2 Remove `KnowledgeBaseEntryKind`, `KnowledgeBaseEntry`, and the old `knowledgeBaseNameExists` from `agent.model.ts`; change `Agent.knowledge_base: KnowledgeBaseEntry[]` to `Agent.knowledge_base_ids: string[]`; update `AgentExportJson` and `createEmptyAgent()` accordingly
- [x] 1.3 Update `toExportJson()` to emit `knowledge_base_ids: agent.knowledge_base_ids` instead of mapping entries
- [x] 1.4 Create `src/mocks/knowledge-bases.mock.ts` seeding one `KnowledgeBase` ("Support Resources", id `kb-support-1`) containing the two entries previously embedded on `agent-1`
- [x] 1.5 Update `src/mocks/agents.mock.ts`: `agent-1` gets `knowledge_base_ids: ['kb-support-1']` (replacing its inline `knowledge_base` array); every other mock agent gets `knowledge_base_ids: []`

## 2. Knowledge Base Service

- [x] 2.1 Create `src/app/core/services/knowledge-base.service.ts` (`providedIn: 'root'`) with an in-memory array seeded from `MOCK_KNOWLEDGE_BASES`: `getKnowledgeBases()`, `getKnowledgeBase(id)`, `createKnowledgeBase(name)` (rejects duplicate names via `knowledgeBaseNameExists`), `updateEntries(id, entries)`, `deleteKnowledgeBase(id)`, all with the existing mock `delay(300)` pattern
- [x] 2.2 Add `getAgentsUsingKnowledgeBase(kbId): Observable<Agent[]>` to `AgentService`, filtering its in-memory agents by `knowledge_base_ids.includes(kbId)`
- [x] 2.3 Add `unlinkKnowledgeBaseEverywhere(kbId)` to `AgentService`, called from `KnowledgeBaseService.deleteKnowledgeBase()` so deleting a knowledge base also removes it from every agent's `knowledge_base_ids`

## 3. Global Knowledge Base Pages

- [x] 3.1 Scaffold `KnowledgeBaseListComponent` at `src/app/features/knowledge-base/knowledge-base-list/`: card grid (name, entry count, linked-agent count via `getAgentsUsingKnowledgeBase`), shimmer-skeleton loading state, empty state, "Create Knowledge Base" quick-create (name input, duplicate-name validation)
- [x] 3.2 Scaffold `KnowledgeBaseDetailComponent` at `src/app/features/knowledge-base/knowledge-base-detail/`: name header, embedded `<app-knowledge-base>` entry editor bound via `KnowledgeBaseService.updateEntries()`, "Used by N agent(s)" section (empty state if none) with links to each agent's Playground editor, delete action with a confirmation stating the linked-agent count
- [x] 3.3 Add routes to `app.routes.ts`: `/knowledge-base` (list) and `/knowledge-base/:id` (detail), lazy-loaded consistent with existing route patterns

## 4. Navigation

- [x] 4.1 Add `{ path: '/knowledge-base', label: 'Knowledge Base', icon: 'fa-solid fa-book' }` to `nav-shell.component.ts`'s `navItems`

## 5. Playground: Linked Knowledge Bases Panel

- [x] 5.1 Scaffold `AgentKnowledgeBasesComponent` at `src/app/features/playground/agent-knowledge-bases/` with `[linkedIds]: string[]` input / `(linkedIdsChange): string[]` output
- [x] 5.2 On init, resolve all knowledge bases via `KnowledgeBaseService.getKnowledgeBases()`; linked/available lists derived client-side from `linkedIds`
- [x] 5.3 Render each linked knowledge base as a card (name, entry count) with an expand toggle that mounts `<app-knowledge-base>` inline bound to that knowledge base's entries, saving through `KnowledgeBaseService.updateEntries()` directly; includes copy noting the knowledge base is shared
- [x] 5.4 Implement "Link existing": a picker listing knowledge bases not already in `linkedIds`; selecting one appends its ID and emits `linkedIdsChange`
- [x] 5.5 Implement "Create new": inline name-only form; on submit, calls `KnowledgeBaseService.createKnowledgeBase(name)`, then appends the new ID to `linkedIds` and emits
- [x] 5.6 Implement "Unlink": removes the ID from `linkedIds` and emits, without deleting the knowledge base or touching its entries
- [x] 5.7 Implement empty state: no knowledge bases linked yet, with "Link existing" / "Create new" controls

## 6. Playground Editor Integration

- [x] 6.1 Replace the old `<app-knowledge-base [entries]="knowledgeBase()" ...>` usage in `playground-editor.component.html`'s side panel with `<app-agent-knowledge-bases [linkedIds]="knowledgeBaseIds()" (linkedIdsChange)="onKnowledgeBaseIdsChange($event)" />`
- [x] 6.2 In `playground-editor.component.ts`: replaced the `knowledgeBase` signal with `knowledgeBaseIds = signal<string[]>([])`; updated `loadFromParams` reset, `loadExistingAgent` (from `agent.knowledge_base_ids`), `onRestoreVersion` (from `snapshot.knowledge_base_ids`), `buildPayload` (`knowledge_base_ids: this.knowledgeBaseIds()`), and the `toolsWatcher` preview-invalidation effect (reads `knowledgeBaseIds()`)
- [x] 6.3 Add `onKnowledgeBaseIdsChange(ids: string[])` handler

## 7. Verification

- [x] 7.1 Manually verify: `/knowledge-base` lists the seeded "Support Resources" knowledge base with correct entry count (2) and linked-agent count (1, agent-1)
- [x] 7.2 Manually verify: creating a knowledge base from the list page with a duplicate name is rejected; a unique name succeeds and navigates to its detail view
- [x] 7.3 Manually verify: the detail view's entry editor (add files, add URL, delete) works identically to the prior per-agent version; "Used by" lists agent-1 with a working link into its Playground editor
- [x] 7.4 Manually verify: deleting a knowledge base linked to an agent removes it from that agent's linked list (confirmed via real SPA navigation to agent-1 after delete)
- [x] 7.5 Manually verify: in Playground, linking an existing knowledge base, creating a new one inline, and unlinking all work and persist on Save (confirmed via SPA nav-away-and-back)
- [x] 7.6 Manually verify: expanding a linked knowledge base in Playground and adding a file there is immediately visible on the global Knowledge Base list page for that knowledge base (confirmed via SPA nav, not full reload)
- [x] 7.7 Manually verify: linking a knowledge base after a completed Preview invalidates it (Go Live unavailable until a new Preview)
- [x] 7.8 Manually verify: the "Knowledge Base" nav item appears in the right-edge rail/flyout and navigates correctly
- [x] 7.9 Manually verify: no console errors throughout
