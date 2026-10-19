## Why

Knowledge base entries currently live embedded inside a single agent (`Agent.knowledge_base: KnowledgeBaseEntry[]`), so the same product docs/FAQs can't be reused across multiple agents without re-uploading them into each one. Customers building several agents (sales, support, FAQ bot) against the same product data need to build a knowledge base once and attach it to as many agents as they like.

## What Changes

- Knowledge bases become a **first-class, shared entity** (`KnowledgeBase { id, name, entries, created_at, updated_at }`), independent of any single agent, managed via a new **"Knowledge Base" item in the main side navigation**.
- New global pages: a **Knowledge Base list** (all knowledge bases, item counts, linked-agent counts, create new) and a **Knowledge Base detail** page (rename-free v1: manage its files/URLs, see which agents currently use it, delete it).
- **Agents can link multiple knowledge bases** (`Agent.knowledge_base_ids: string[]`), replacing the old single embedded array. The existing per-entry capability (add files, add URL, duplicate-name prevention, remove entry) is unchanged in behavior — it now operates on a shared `KnowledgeBase`'s entries instead of an agent's own inline list.
- The Playground editor's Knowledge Base panel changes from "manage this agent's own entries" to **"manage this agent's linked knowledge bases"**: link an existing knowledge base, create a new one inline (given a name/label, matching how a URL entry already has a label), unlink one, and — per explicit request — **manage a linked knowledge base's files directly inline in Playground**, with changes applying everywhere that knowledge base is linked.
- **Migration**: agent-1's existing embedded entries (seeded in the prior change) become a new shared knowledge base ("Support Resources"), linked to agent-1, so no demo data is lost.
- Out of scope (unchanged from the prior change): no real file parsing/ingestion, no embeddings, no live retrieval — this remains configuration-capture only.

## Capabilities

### New Capabilities
- `knowledge-base-library`: Global management of shared knowledge bases — list, create, view/manage entries, see linked agents, delete. Lives behind a new main-nav "Knowledge Base" item.

### Modified Capabilities
- `agent-knowledge-base`: Requirements are reframed from "the agent's entries" to "a knowledge base's entries" (same add-files/add-url/dedupe/remove behavior, now entity-agnostic since a knowledge base is no longer owned by a single agent).
- `playground`: The Knowledge Base side panel changes from a single embedded entry-list to a linked-knowledge-bases manager (link/create/unlink, with inline entry management per linked knowledge base).
- `nav-shell`: Gains a fourth top-level navigation item, "Knowledge Base".

## Impact

- Affected frontend: `src/app/core/models/knowledge-base.model.ts` (new — `KnowledgeBase`, `KnowledgeBaseEntry` moved out of `agent.model.ts`), `agent.model.ts` (`knowledge_base` entries array → `knowledge_base_ids: string[]`), new `KnowledgeBaseService` + `src/mocks/knowledge-bases.mock.ts`, `AgentService` (new method to look up agents linked to a given knowledge base), new routes/components under `src/app/features/knowledge-base/`, `nav-shell.component.ts` (new nav item), `playground-editor.component.ts`/`.html` (new linked-knowledge-bases panel replacing the old embedded one), the existing `KnowledgeBaseComponent` entry-editor is reused as-is (already array-agnostic).
- No backend/API changes; everything remains mocked, consistent with the rest of the app.
- **Data shape change**: `Agent.knowledge_base` (array of entries) is replaced by `Agent.knowledge_base_ids` (array of IDs). `AgentVersion` snapshots capture which knowledge bases were linked at that point, not their contents (contents are shared/external state, not this agent's own history).
