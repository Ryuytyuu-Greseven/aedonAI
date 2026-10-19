## Context

The prior change (`add-agent-knowledge-base`, archived) built knowledge base entries as an array embedded directly on `Agent`, edited via `KnowledgeBaseComponent` (`[entries]`/`(entriesChange)`, purely array-in/array-out — it has no notion of "whose" entries they are). That component's design turns out to be exactly right for reuse here unchanged: a knowledge base's entry list still needs the same add-files/add-url/dedupe/remove UI, just now operating on a shared `KnowledgeBase.entries` instead of an agent's own inline array.

What changes is *ownership*: entries move from being an agent's own data to being owned by a standalone `KnowledgeBase` entity that many agents can reference. This is a genuine data-model migration (`Agent.knowledge_base: KnowledgeBaseEntry[]` → `Agent.knowledge_base_ids: string[]`), not just an additive change, so `agent-1`'s existing seeded entries need to become a real shared `KnowledgeBase` record rather than being dropped.

## Goals / Non-Goals

**Goals:**
- `KnowledgeBase` as a standalone, listable, creatable entity, reachable from a new main-nav item.
- Agents link zero or more knowledge bases (array of IDs), so one knowledge base can genuinely serve many agents.
- From Playground: link an existing knowledge base, create a new one inline (with a name), unlink one, and manage a linked knowledge base's files inline (edits apply globally, since it's shared).
- The global Knowledge Base detail page shows which agents currently use it.
- Migrate existing demo data (agent-1's entries) into a real shared knowledge base rather than deleting it.

**Non-Goals:**
- No real file parsing/ingestion/embeddings/retrieval — unchanged from the prior change, still configuration-capture only.
- No per-agent override of a shared knowledge base's entries (e.g. "use this file for agent A but not agent B") — linking is all-or-nothing at the knowledge-base level, matching how MCP servers/tools work as flat lists.
- No knowledge-base-level permissions/sharing across customer accounts — this is a single mock tenant, same as the rest of the app.

## Decisions

**Reuse `KnowledgeBaseComponent` unchanged**: its `[entries]`/`(entriesChange)` contract already doesn't know or care whether the array belongs to an agent or a shared knowledge base — it's a pure entry-list editor. It gets used in two places now: the Knowledge Base detail page (bound directly to a `KnowledgeBase`'s entries via `KnowledgeBaseService`), and inline inside Playground's linked-knowledge-bases panel when the user expands a specific linked knowledge base to edit its files. No changes needed to this component or its existing `agent-knowledge-base` capability requirements beyond wording (see below).

**New model file, not an extension of `agent.model.ts`**: `KnowledgeBaseEntry`, `KnowledgeBaseEntryKind`, and the new `KnowledgeBase` interface move to `src/app/core/models/knowledge-base.model.ts` (mirroring how `call-record.model.ts`/`agent-template.model.ts` are already separate domain model files) — knowledge bases are no longer an agent-owned concept, so they don't belong in `agent.model.ts` anymore. `agent.model.ts` keeps only `knowledge_base_ids: string[]` on `Agent`.

**New `KnowledgeBaseService`** (`providedIn: 'root'`), mirroring `CallRecordService`'s/`AgentService`'s mock-array-plus-`delay()` pattern: `getKnowledgeBases()`, `getKnowledgeBase(id)`, `createKnowledgeBase(name)`, `updateEntries(id, entries)`, `deleteKnowledgeBase(id)`. Seeded from a new `src/mocks/knowledge-bases.mock.ts`.

**Cross-referencing linked agents**: rather than knowledge bases knowing about agents (which would create a circular/duplicated relationship to maintain), `AgentService` gains `getAgentsUsingKnowledgeBase(kbId): Observable<Agent[]>` that filters its own in-memory agents array by `knowledge_base_ids.includes(kbId)`. The Knowledge Base detail page calls this to render "Used by N agent(s)". This keeps `knowledge_base_ids` as the single source of truth for the relationship.

**Playground's new linked-knowledge-bases panel** (`AgentKnowledgeBasesComponent`, replacing the old direct `KnowledgeBaseComponent` usage in `playground-editor.component.html`): `[linkedIds]: string[]` / `(linkedIdsChange): string[]` I/O, matching the array-signal pattern already used for `tools`/`mcpServers`. Internally it:
- Resolves `linkedIds` to full `KnowledgeBase` summaries via `KnowledgeBaseService.getKnowledgeBases()` (filtered client-side, consistent with how other list-then-filter patterns already work in this app).
- Renders each linked knowledge base as a card (name, item count) with an expand toggle that mounts `<app-knowledge-base>` inline, bound to that knowledge base's entries, saving through `KnowledgeBaseService.updateEntries()` directly (not through the agent's save flow — the whole point is these edits apply globally and immediately, matching the explicit "manage files inline... changes apply everywhere" decision).
- "+ Link existing" opens a small picker (list of not-yet-linked knowledge bases) that appends to `linkedIds` and emits.
- "+ Create new" opens an inline name-only form; on submit, calls `KnowledgeBaseService.createKnowledgeBase(name)`, then appends the new ID to `linkedIds` and emits — so a brand-new knowledge base is simultaneously created globally and linked to the current agent in one action.
- "Unlink" removes the ID from `linkedIds` and emits — it does not delete the knowledge base or its entries, since other agents may still use it.

**Playground save/version semantics**: `knowledge_base_ids` is included in `buildPayload()` exactly like `tools`/`mcp_servers` today (a plain array of strings on the agent). Because entry edits save directly to `KnowledgeBaseService` (not through the agent), they take effect immediately regardless of whether the user clicks the agent's "Save" button — only linking/unlinking/creating changes what's in `knowledge_base_ids`, which does flow through the normal save. `AgentVersion` snapshots therefore capture "which knowledge bases were linked," not their contents, consistent with treating knowledge bases as external shared state.

**Global pages** (`src/app/features/knowledge-base/`): `KnowledgeBaseListComponent` at `/knowledge-base` (card grid — name, entry count, linked-agent count, "Create Knowledge Base" quick action; reuses the established shimmer-skeleton/empty-state card-grid pattern from Dashboard/Monitor List), `KnowledgeBaseDetailComponent` at `/knowledge-base/:id` (name header, the reused `<app-knowledge-base>` entry editor, a "Used by" list of linked agents with links into their Playground editor, and a delete action gated by a confirmation that mentions how many agents will be affected).

**Nav item**: `nav-shell.component.ts`'s `navItems` gains `{ path: '/knowledge-base', label: 'Knowledge Base', icon: 'fa-solid fa-book' }`, placed after "Monitor Agents" — no structural change to the nav-shell component itself, just a new entry in its existing data-driven list.

**Migration of existing seed data**: `src/mocks/knowledge-bases.mock.ts` seeds one `KnowledgeBase` ("Support Resources", id `kb-support-1`) containing the two entries previously embedded on `agent-1` (`Support-FAQ.pdf`, `Product help center` URL). `agents.mock.ts`'s `agent-1` gets `knowledge_base_ids: ['kb-support-1']`; every other mock agent gets `knowledge_base_ids: []`.

## Risks / Trade-offs

- [Editing a linked knowledge base's files from inside one agent's Playground silently affects other agents using it] → This is the explicitly requested behavior ("manage files inline... changes apply everywhere"); mitigated with inline copy in the expanded editor noting the knowledge base is shared and how many agents use it, so the effect isn't a surprise.
- [`AgentVersion` no longer captures full knowledge base contents in its snapshot, only linked IDs] → Correct and intentional per the decision above; flagged here so it isn't mistaken for a regression — restoring an old agent version restores which knowledge bases were linked, not a frozen copy of their contents (which wouldn't make sense for shared, evolving data anyway).
- [Deleting a knowledge base that's still linked to agents needs a clear UX so it isn't accidental data loss for multiple agents at once] → Confirmation dialog explicitly states the linked-agent count before deleting.

## Open Questions

- None blocking. Renaming an existing knowledge base and per-agent "which fields of a shared KB apply" are natural future extensions, not needed for this change.
