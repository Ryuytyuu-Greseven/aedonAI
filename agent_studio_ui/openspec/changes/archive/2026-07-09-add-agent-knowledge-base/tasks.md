## 1. Data Model

- [x] 1.1 Add `KnowledgeBaseEntryKind = 'file' | 'url'` and `KnowledgeBaseEntry { id; kind; name; url?; file_type?; file_size_bytes?; uploaded_at }` to `src/app/core/models/agent.model.ts`
- [x] 1.2 Add `knowledge_base: KnowledgeBaseEntry[]` to the `Agent` interface and `AgentExportJson` interface
- [x] 1.3 Initialize `knowledge_base: []` in `createEmptyAgent()` and in all `MOCK_AGENTS` entries; seed one example file entry and one example URL entry on `agent-1`
- [x] 1.4 Add `knowledgeBaseNameExists(entries: KnowledgeBaseEntry[], name, excludeId?)` duplicate-name helper (case-insensitive, across both kinds), mirroring `mcpServerNameExists`
- [x] 1.5 Update `toExportJson()` to include `knowledge_base` entries as-is (no redaction needed — no secrets in this data shape)

## 2. Knowledge Base Component

- [x] 2.1 Scaffold `src/app/features/playground/knowledge-base/knowledge-base.component.ts` (+ `.html`, `.css`) with `[entries]: KnowledgeBaseEntry[]` input / `(entriesChange): KnowledgeBaseEntry[]` output
- [x] 2.2 Implement list view: icon per entry (by `file_type` or a link icon for `kind: 'url'`), name, metadata line (file: type + formatted size; url: the URL), added date
- [x] 2.3 Implement empty state: explains these are reference materials being catalogued (not yet used live), with "Add Files" and "Add URL" controls
- [x] 2.4 Implement "Add Files": hidden multi-select `<input type="file" accept=".pdf,.doc,.docx,.txt,.csv,.md">`; on selection, map each `File` to a new entry (`name`, `file_type` from extension, `file_size_bytes` from `File.size`, `uploaded_at` = now) without reading file contents
- [x] 2.5 Implement "Add URL": inline form (label + URL text input), validates both required and URL format (`http(s)://...`) before adding a `kind: 'url'` entry
- [x] 2.6 Implement duplicate-name validation on both add paths using `knowledgeBaseNameExists`, inline error messaging
- [x] 2.7 Implement delete flow with confirmation dialog, mirroring `McpServersManagerComponent`'s delete-confirm modal pattern
- [x] 2.8 Confirmed no additional loading state needed — entries arrive synchronously with the parent's already-loaded agent

## 3. Playground Editor: Two-Column Layout

- [x] 3.1 In `playground-editor.component.html`, wrap the existing tab strip + all four `@if (activeTab() === ...)` blocks in a `.playground-editor-main` container
- [x] 3.2 Add `.playground-editor-side` container with `<app-knowledge-base [entries]="knowledgeBase()" (entriesChange)="onKnowledgeBaseChange($event)" />`, as a sibling to `.playground-editor-main`, both inside a new `.playground-editor-columns` wrapper
- [x] 3.3 Update `playground-editor.component.css`: `.playground-editor` max-width `860px` → `1280px`; add `.playground-editor-columns` (flex row, gap), `.playground-editor-main` (flex: 1, min-width: 0), `.playground-editor-side` (fixed width ~380px, flex-shrink: 0); add a narrow-viewport `@media` breakpoint that stacks the columns
- [x] 3.4 Confirmed the History side panel (fixed overlay) renders correctly above the new two-column layout, unaffected by it
- [x] 3.5 (bonus, beyond original scope) Updated the `loading()` skeleton to also render in the two-column shape, avoiding a single→two-column layout flash

## 4. Playground Editor: Data Wiring

- [x] 4.1 Add `readonly knowledgeBase = signal<KnowledgeBaseEntry[]>([])` to `playground-editor.component.ts`, alongside `tools`/`mcpServers`
- [x] 4.2 Reset `knowledgeBase` to `[]` in `loadFromParams()`'s reset block; populate from `agent.knowledge_base` in `loadExistingAgent()`
- [x] 4.3 Add `onKnowledgeBaseChange(entries: KnowledgeBaseEntry[])` handler
- [x] 4.4 Include `knowledge_base: this.knowledgeBase()` in `buildPayload()`
- [x] 4.5 Extend the existing `toolsWatcher` effect to also read `knowledgeBase()`, so changes invalidate a completed Preview like Tools/MCP servers already do
- [x] 4.6 (bonus, beyond original scope) `onRestoreVersion()` now also restores `knowledge_base` from the version snapshot, for consistency with tools/mcpServers restore

## 5. Verification

- [x] 5.1 Manually verify: Knowledge Base panel renders on the right and stays visible while switching between Build/Integrations/MCP Servers/Preview tabs
- [x] 5.2 Manually verify: adding multiple files at once creates one entry per file with correct name/type/size; adding a URL creates a correct `kind: url` entry
- [x] 5.3 Manually verify: duplicate-name validation blocks a duplicate file and a duplicate URL label; required/format validation blocks an invalid URL
- [x] 5.4 Manually verify: deleting an entry requires confirmation and removes it on confirm
- [x] 5.5 Manually verify: saving from any left-column tab persists knowledge base changes; reopening the agent (via real SPA navigation) shows them
- [x] 5.6 Manually verify: completing a Preview, then adding a knowledge base entry, invalidates the Preview (Go Live becomes unavailable again until a new Preview)
- [x] 5.7 Manually verify: narrow viewport (800px) stacks the Knowledge Base panel below the main column instead of beside it
- [x] 5.8 Manually verify: no console errors throughout
