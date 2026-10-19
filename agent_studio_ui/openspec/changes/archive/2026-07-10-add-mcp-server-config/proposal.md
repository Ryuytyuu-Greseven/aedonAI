## Why

Customers building sales, support, and contact-center agents often run their own internal MCP (Model Context Protocol) servers exposing service-request tools (create/view/update/cancel). Today the agent editor only supports manually-defined tools with no way to reference a customer's MCP server. Customers need a way to register one or more MCP server connections against an agent so those servers' tools can later be wired in.

## What Changes

- Add a global, agent-level list of MCP server connections (`mcp_servers`), separate from the existing `tools` array.
- Each entry has: `id` (auto-generated UUID), `name` (required label), `url` (required endpoint), `api_key` (optional, for auth).
- New "MCP Servers" section in the **Playground editor** (the single agent creation/editing surface) — list view + add/edit/delete form for managing these entries, following the same interaction pattern as the existing Export Destinations section.
- The `api_key` field is masked on input (password-style) and redacted (never shown in plaintext) everywhere it is displayed.
- Agent model gains a top-level `mcp_servers` array.
- Out of scope: live connection/discovery of tools from the MCP server, and runtime consent-before-execution flows. These are captured as configuration only in this change; no live network calls are made to customer MCP servers.

## Capabilities

### New Capabilities
- `mcp-servers`: Agent-level management of MCP server connection entries (list, add, edit, delete) including masked API key input and redacted display.

### Modified Capabilities
- `playground`: The Playground editor gains a new "MCP Servers" section, alongside Export Destinations, for managing the agent's `mcp_servers` entries.

## Impact

- Affected frontend: Playground editor (`playground-editor.component.ts`/`.html`), agent model (`agent.model.ts`).
- No backend/API changes in this change; all persistence remains mocked, consistent with the rest of the app.
- Secure storage of `api_key` (secrets manager/vault) is explicitly deferred to a future change; this change only guarantees the value is masked in the UI and never re-displayed in plaintext once set.
