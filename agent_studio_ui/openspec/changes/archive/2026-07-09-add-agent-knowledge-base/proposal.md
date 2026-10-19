## Why

Agents today are built from prompt/behavior/tools/MCP servers only — there's no way for a customer to ground an agent in their own business data (product docs, FAQs, pricing sheets, site content) so it actually knows what it's talking about. Customers need to attach multiple reference files (and reference URLs) per agent while building it.

## What Changes

- Add a **Knowledge Base** concept: a per-agent list of reference entries, each either an uploaded file (PDF/DOC/DOCX/TXT/CSV/MD) or a reference URL (e.g. a page on the customer's site), captured with name, type, size (for files), and an uploaded timestamp.
- Restructure the **Playground editor** into two columns: the existing tab strip (Build/Integrations/MCP Servers/Preview) moves to a left column; a new, **always-visible** Knowledge Base panel occupies a right column — not gated behind a tab, since it should be reachable regardless of which tab is active, using space freed up by the earlier full-width layout work. On narrow viewports the columns stack (side panel below the main form).
- The Knowledge Base panel supports adding multiple files at once, adding a URL with a label, and removing entries, with duplicate-name prevention and inline validation — same interaction pattern as the existing Export Destinations / MCP Servers sections.
- Agent model gains a top-level `knowledge_base` array, persisted the same way `tools`/`mcp_servers` are (included in every save regardless of which left-column tab is active).
- Adding/removing/editing knowledge base entries invalidates a completed Preview in the current session, consistent with how Tools/MCP server changes already do.
- Out of scope (explicitly): actually parsing/ingesting file contents, any real upload endpoint, embeddings/vector storage, or the agent using this data at call-time. This change captures and manages the list only — no live file processing happens anywhere in this frontend, consistent with how MCP server connections are captured without live connection/validation.

## Capabilities

### New Capabilities
- `agent-knowledge-base`: Per-agent management of knowledge base entries (files and URLs) — add, list, remove, validate.

### Modified Capabilities
- `playground`: The Playground editor's layout changes from a single column to two columns — existing tabbed content on the left, a new persistent Knowledge Base panel on the right, reachable regardless of active tab.

## Impact

- Affected frontend: `playground-editor.component.ts`/`.html`/`.css` (two-column layout, new signal, save/preview-invalidation wiring), a new `knowledge-base` component under `src/app/features/playground/`, `agent.model.ts` (new `KnowledgeBaseEntry` type, `knowledge_base` field, duplicate-name helper), mock agent seed data.
- No backend/API changes; file selection is captured client-side via the browser file picker (name/size/type only — file contents are never read, stored, or uploaded anywhere) and URLs are stored as plain strings, consistent with the rest of the app's mock-only persistence.
