## Context

The Playground editor currently renders a single centered column (`.playground-editor`, max-width `860px`, a deliberate readability cap from the earlier full-canvas layout work) containing a tab strip (Build/Integrations/MCP Servers/Preview) and that tab's content. The user explicitly asked for the Knowledge Base to be **always visible**, not another tab, occupying the horizontal space that the earlier "utilize the full canvas" work opened up on wide screens — so this change restructures the editor into two columns rather than adding a fifth tab.

Array-valued sub-resources in Playground already follow one consistent pattern: a `signal<T[]>([])` on the component, a dedicated manager component with `[array]`/`(arrayChange)` I/O (`ExportDestinationsComponent`, `McpServersManagerComponent`, most recently `CallLogComponent`'s filters), wired into `loadFromParams`/`loadExistingAgent`/`buildPayload`, and folded into the existing preview-invalidation effect. `KnowledgeBaseEntry` follows the same shape.

## Goals / Non-Goals

**Goals:**
- Two-column Playground layout: existing tabbed content on the left, a persistent Knowledge Base panel on the right, visible regardless of active tab.
- Responsive: stacks to a single column on narrow viewports (reuse the app's established breakpoint convention, e.g. `max-width: 900px`, matching other component-level breakpoints already in the codebase).
- Support both file uploads (multi-select) and reference URLs in one list, each entry removable, with duplicate-name prevention.
- Knowledge base changes persist with the rest of the agent and invalidate a completed Preview, same as Tools/MCP servers.

**Non-Goals:**
- No real file upload, parsing, storage, or retrieval — file contents are never read past `File.name`/`File.size`/extension. This is a configuration-capture UI only, same posture as MCP server connections (captured, not connected).
- No URL crawling/validation beyond basic format checking.
- No node/flow binding — like MCP servers and tools, this is a flat, agent-level list.

## Decisions

**Two columns, not a fifth tab**: `playground-editor.component.html`'s existing tab strip + all four `@if (activeTab() === ...)` blocks move into a `.playground-editor-main` left column; a new `<app-knowledge-base>` sits in a `.playground-editor-side` right column, both inside a `.playground-editor-columns` flex row. This directly matches the explicit ask ("always-visible... not gated by a tab... utilize the space"), and differs from every other array-resource so far in this app (which were tabs) — documented here so it isn't "fixed" back to a tab pattern later without re-reading this rationale.

**Layout width**: `.playground-editor`'s max-width increases from `860px` to `1280px` to fit both columns (`~860px` main column stays the same effective reading width, `~380px` side column, `24px` gap). Below `900px` viewport, `.playground-editor-columns` switches to `flex-direction: column` and the side panel renders full-width below the main column, consistent with the app's existing per-component narrow-viewport fallbacks (e.g. Monitor Detail's `@media (max-width: 640px)`).

**Component I/O**: `KnowledgeBaseComponent` takes `[entries]: KnowledgeBaseEntry[]` / emits `(entriesChange): KnowledgeBaseEntry[]`, mirroring `McpServersManagerComponent`'s `[mcpServers]`/`(mcpServersChange)` — not bound into the reactive form, since Playground keeps array-valued sub-resources as standalone signals.

**Data shape**: `KnowledgeBaseEntry { id, kind: 'file' | 'url', name, url?, file_type?, file_size_bytes?, uploaded_at }`. `kind` discriminates file vs. URL entries within one flat list (one panel, one "N items" count) rather than two separate lists, since the user asked for "multiple files... any specific data... through various types of files" as one knowledge base, not file-uploads and URLs as separate concepts.

**File capture**: a hidden multi-select `<input type="file" accept=".pdf,.doc,.docx,.txt,.csv,.md">` triggered by an "Add Files" button. On `change`, each selected `File` becomes an entry: `name` = filename, `file_type` = lower-cased extension, `file_size_bytes` = `File.size`, `uploaded_at` = now. The `File` object itself is discarded immediately after reading these three properties — never stored, never read as a blob/data URL, never sent anywhere. This keeps memory bounded regardless of how large a file the user picks, and is honest about the non-goal (no real ingestion).

**URL capture**: an inline "Add URL" form (label + URL text input) with basic `https?://` format validation before appending an entry with `kind: 'url'`, `name` = the user's label, `url` = the value, no `file_type`/`file_size_bytes`.

**Validation**: duplicate-name prevention across the whole list (file and URL entries share one namespace) via a new `knowledgeBaseNameExists(entries, name, excludeId?)` helper in `agent.model.ts`, mirroring `mcpServerNameExists`. Required-field inline errors for the URL form (both label and URL required, URL must look like a URL).

**Preview invalidation**: `playground-editor.component.ts`'s existing `toolsWatcher` effect (which reads `tools()`/`mcpServers()` and calls `invalidatePreview()`) is extended to also read `knowledgeBase()`, so any change here invalidates a completed Preview exactly like Tools/MCP server changes already do — no new effect needed, one line added to the existing one.

**Persistence**: `knowledge_base: this.knowledgeBase()` added to `buildPayload()`, `this.knowledgeBase.set(agent.knowledge_base)` added to `loadExistingAgent()`, `this.knowledgeBase.set([])` added to the reset block in `loadFromParams()` — identical wiring to how `mcpServers` was added in the MCP Servers change.

## Risks / Trade-offs

- [Users may expect uploaded files to actually inform agent responses immediately] → Mitigated with clear empty-state/help copy in the panel explaining these are reference materials being catalogued, not yet connected to live answers — same mitigation already used for MCP servers' "connection entries only" empty state.
- [Two-column layout adds a new responsive breakpoint to reason about] → Bounded: only `playground-editor.component.css` gets a new `@media` block; no other page's layout changes.
- [`File.size`-only capture means duplicate-content files with different names aren't caught] → Acceptable; name-based duplicate prevention matches how every other array resource in this app (tools, MCP servers) already dedupes, and real content-dedup would require actually reading file contents, which is out of scope.

## Open Questions

- None blocking. Real ingestion (parsing, embeddings, retrieval) is a backend concern for a future change once a real backend exists.
