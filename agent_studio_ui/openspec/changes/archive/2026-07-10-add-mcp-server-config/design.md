## Context

The Playground is the single agent creation/editing surface (per `playground/spec.md`: "It replaces the free-form Agent Builder as the active creation path"). The Agent Builder route still exists in the codebase but is not linked from anywhere in the app (Dashboard's "Create Agent"/"Edit" actions both route to `/playground/...`) — it is not part of the real product surface, so this change does not touch it.

Playground models an agent through a reactive form (`agent_name`, `greeting`, `prompt`, `behavior`, referral fields) plus standalone signals for array-valued sub-resources — `tools: signal<Tool[]>`, wired to the existing `app-export-destinations` component via `[tools]`/`(toolsChange)`. There is no notion of an external server or connection today. This change adds a way to *register* MCP server connection details against an agent, as a new array-valued sub-resource following the exact same pattern as `tools`/Export Destinations. It is a pure configuration-capture feature: no live network calls to customer servers, no tool discovery, no runtime execution/consent flow. Those are explicitly deferred.

## Goals / Non-Goals

**Goals:**
- Let a user add, edit, and delete one or more MCP server entries (`name`, `url`, `api_key`) against an agent, in a new "MCP Servers" section of the Playground editor.
- Persist entries as a new top-level `mcp_servers` array on the agent, following the same mock-save pattern as `tools`.
- Mask `api_key` on input and never re-display it in plaintext once set.

**Non-Goals:**
- Connecting to the MCP server, validating the URL is reachable, or discovering its exposed tools (`tools/list`).
- Binding MCP-sourced tools to nodes/flow — MCP servers are a flat, agent-level list; Playground has no node/flow editing at all.
- Runtime consent-before-execution UX — this is a design-time capability only.
- Secure secret storage (vault/secrets manager) for `api_key` — the real backend does not exist yet; masking here is a frontend display guarantee only, not encryption at rest.
- Any change to the Agent Builder route — it is unreachable from the app's navigation and out of scope.

## Decisions

**Playground section vs. Agent Builder tab**: Add MCP Servers as a new section card in the Playground editor (alongside Export Destinations), not as a tab in Agent Builder. Rationale: Agent Builder is not part of the actual product surface (unreachable from Dashboard/nav); Playground is the sole creation/editing path, so that's where customers will actually encounter this.

**Component I/O shape**: The `McpServersManagerComponent` takes `[mcpServers]: McpServer[]` / emits `(mcpServersChange): McpServer[]`, mirroring `ExportDestinationsComponent`'s `[tools]`/`(toolsChange)` — not a whole-`Agent` input/output — since Playground doesn't hold a single `Agent` object in component state, only a form plus per-resource signals.

**Data shape**: `mcp_servers: [{ id, name, url, api_key }]` at the same level as `tools` on the `Agent` model. `id` is an auto-generated UUID (consistent with tool IDs). `name` and `url` are required; `api_key` is optional.

**Redaction strategy**: Masking happens at render time in the manager component — the in-memory `mcpServers` signal keeps the real `api_key` (needed so the field can be edited and persisted), but the list view and edit form always show `redactApiKey()`'s masked form (last 4 characters visible, e.g. `••••1234`, or fully masked if shorter). Editing an entry without entering a new API key value preserves the existing key unchanged. Playground has no JSON view/export surface, so there is no separate export-redaction concern to cover here (unlike the earlier draft of this design, which assumed an Agent Builder-style "View JSON" panel).

**Validation**: Reuse the same validation pattern as Tools/Export Destinations (inline required-field errors, duplicate-name prevention) — a duplicate `name` among `mcp_servers` shows an inline error the same way a duplicate tool name would.

## Risks / Trade-offs

- [`api_key` still lives in plaintext in the in-memory app state and in any mock POST/PATCH payload] → Acceptable for this change since there is no real backend yet; flagged in the proposal as a follow-up once real persistence/secrets storage exists.
- [Users may expect the MCP servers list to auto-discover tools, since that's the eventual value] → Mitigate with clear empty-state copy in the new section explaining these are connection entries only, tool binding comes later.
- [Adding a new top-level array changes the canonical `Agent` shape] → Since the whole project is still spec-driven with mock data, this is a low-cost, additive/non-breaking change (existing agents simply have `mcp_servers: []`).

## Open Questions

- None blocking — auth beyond a single `api_key` (e.g. custom headers, OAuth) and live tool discovery are intentionally deferred to future changes per the proposal.
