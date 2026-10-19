## ADDED Requirements

### Requirement: Knowledge Base Side Panel
The system SHALL render the Playground editor as two columns on wide viewports: the existing tabbed content (Build, Integrations, MCP Servers, Preview) in a left column, and a persistent Knowledge Base panel in a right column, per the `agent-knowledge-base` capability. The Knowledge Base panel SHALL be visible regardless of which left-column tab is active, and SHALL NOT be gated behind a tab.

#### Scenario: Knowledge Base visible on any tab
- **WHEN** the user is on the Integrations, MCP Servers, or Preview tab
- **THEN** the Knowledge Base panel remains visible in the right column without switching tabs

#### Scenario: Narrow viewport stacks the columns
- **WHEN** the viewport is narrow (below the editor's responsive breakpoint)
- **THEN** the Knowledge Base panel renders below the main tabbed content instead of beside it

### Requirement: Knowledge Base Persists With Agent Save
The system SHALL include the agent's `knowledge_base` entries in every save (create or update), regardless of which left-column tab was active when Save was clicked, consistent with how `tools` and `mcp_servers` are persisted.

#### Scenario: Saving from any tab persists knowledge base changes
- **WHEN** the user adds a knowledge base entry, switches to the MCP Servers tab, and clicks Save there
- **THEN** the new knowledge base entry is included in the saved agent

### Requirement: Knowledge Base Changes Invalidate Preview
The system SHALL invalidate a completed Preview in the current editing session when the agent's knowledge base entries change, consistent with how Tools and MCP server changes already invalidate a completed Preview.

#### Scenario: Adding a knowledge base entry after a successful preview
- **WHEN** the user has completed a successful Preview and then adds or removes a knowledge base entry
- **THEN** the Preview is invalidated and a new Preview is required before Go Live is available again
