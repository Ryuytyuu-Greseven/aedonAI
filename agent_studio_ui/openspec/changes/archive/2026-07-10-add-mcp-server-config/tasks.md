## 1. Data Model

- [x] 1.1 Add `McpServer` interface (`id`, `name`, `url`, `api_key?`) to `src/app/core/models/agent.model.ts`
- [x] 1.2 Add `mcp_servers: McpServer[]` to the `Agent` interface and `AgentExportJson` interface in `agent.model.ts`
- [x] 1.3 Initialize `mcp_servers: []` in `createEmptyAgent()` and in all `MOCK_AGENTS` entries
- [x] 1.4 Add a `redactApiKey(key: string): string` helper (mask all but last 4 chars) in `agent.model.ts`
- [x] 1.5 Update `toExportJson()` to include `mcp_servers`, mapping each entry's `api_key` through `redactApiKey`
- [x] 1.6 Add `mcpServerNameExists(servers: McpServer[], name, excludeId?)` duplicate-name helper, array-based (mirrors `isDestinationTool`-style helpers, not agent-scoped)

## 2. MCP Servers Manager Component (Playground)

- [x] 2.1 Scaffold `src/app/features/playground/mcp-servers-manager/mcp-servers-manager.component.ts` (+ `.html`, `.css`), with `[mcpServers]: McpServer[]` input / `(mcpServersChange): McpServer[]` output — mirroring `ExportDestinationsComponent`'s `[tools]`/`(toolsChange)` pattern
- [x] 2.2 Implement list view: render `name` + `url` per entry, with `api_key` shown masked when set
- [x] 2.3 Implement empty state: "No MCP servers yet. Add your first server connection." with "Add MCP Server" button
- [x] 2.4 Implement Add/Edit form: `name` (required), `url` (required), `api_key` (optional, password-style input)
- [x] 2.5 Implement inline validation: required-field errors, duplicate-name prevention
- [x] 2.6 Implement edit flow: pre-fill `name`/`url`; render API key field masked/blank-with-placeholder, only overwrite `api_key` if the user enters a new value
- [x] 2.7 Implement delete flow with confirmation dialog

## 3. Playground Editor Integration

- [x] 3.1 Add `mcpServers` signal to `playground-editor.component.ts`, reset on load (`loadFromParams`), populated from `agent.mcp_servers` in `loadExistingAgent`
- [x] 3.2 Add `onMcpServersChange()` handler and include `mcp_servers: this.mcpServers()` in `buildPayload()`
- [x] 3.3 Add `mcpServers` to the existing preview-invalidation effect (`toolsWatcher`), consistent with how `tools` changes invalidate a completed preview
- [x] 3.4 Add "MCP Servers" section card to `playground-editor.component.html`, positioned after "Export destinations", wired to `[mcpServers]`/`(mcpServersChange)`

## 4. Agent Builder Cleanup

- [x] 4.1 Confirm Agent Builder (`/agents/*`) is unreachable from app navigation (no `routerLink`/route references anywhere) — out of scope, left untouched otherwise
- [x] 4.2 Do not add any MCP Servers UI to Agent Builder; revert the earlier (incorrect) tab addition there

## 5. Verification

- [x] 5.1 Manually verify in a real browser (Playground editor for an existing agent): add multiple MCP server entries (with and without an API key), confirm masked API key display in list/edit form
- [x] 5.2 Manually verify: duplicate name validation, required-field validation, edit-without-touching-key preserves existing key, delete removes entry with confirmation
- [x] 5.3 Manually verify: saving the Playground form persists `mcp_servers` via the mock `agentService.updateAgent`/`createAgent` call
- [x] 5.4 Manually verify: no console errors during the above flows
