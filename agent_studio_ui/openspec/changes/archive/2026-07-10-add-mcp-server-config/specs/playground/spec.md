## ADDED Requirements

### Requirement: MCP Servers Section

The system SHALL provide an "MCP Servers" section within the Playground editor, positioned alongside the Export Destinations section, where the user can add, edit, and remove MCP server connection entries per the `mcp-servers` capability.

#### Scenario: Managing MCP servers while editing an agent
- **WHEN** the user opens the MCP Servers section of the Playground editor
- **THEN** the agent's current `mcp_servers` entries are listed, with controls to add, edit, or remove them, consistent with the `mcp-servers` capability

#### Scenario: Persisting MCP servers on save
- **WHEN** the user saves the Playground editor form after adding, editing, or removing MCP server entries
- **THEN** the agent's `mcp_servers` array is included in the persisted agent payload
