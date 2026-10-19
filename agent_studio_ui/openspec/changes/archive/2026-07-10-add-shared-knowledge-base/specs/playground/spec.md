## MODIFIED Requirements

### Requirement: Knowledge Base Side Panel
The system SHALL render the Playground editor as two columns on wide viewports: the existing tabbed content (Build, Integrations, MCP Servers, Preview) in a left column, and a persistent panel for managing the agent's **linked knowledge bases** in a right column, per the `knowledge-base-library` and `agent-knowledge-base` capabilities. The panel SHALL be visible regardless of which left-column tab is active, and SHALL NOT be gated behind a tab.

#### Scenario: Knowledge Base panel visible on any tab
- **WHEN** the user is on the Integrations, MCP Servers, or Preview tab
- **THEN** the linked-knowledge-bases panel remains visible in the right column without switching tabs

#### Scenario: Narrow viewport stacks the columns
- **WHEN** the viewport is narrow (below the editor's responsive breakpoint)
- **THEN** the linked-knowledge-bases panel renders below the main tabbed content instead of beside it

### Requirement: Knowledge Base Persists With Agent Save
The system SHALL include the agent's `knowledge_base_ids` (linked knowledge base references) in every save (create or update), regardless of which left-column tab was active when Save was clicked, consistent with how `tools` and `mcp_servers` are persisted.

#### Scenario: Saving from any tab persists linked-knowledge-base changes
- **WHEN** the user links a knowledge base, switches to the MCP Servers tab, and clicks Save there
- **THEN** the newly linked knowledge base is included in the saved agent's `knowledge_base_ids`

### Requirement: Knowledge Base Changes Invalidate Preview
The system SHALL invalidate a completed Preview in the current editing session when the agent's linked knowledge bases change (linked or unlinked), consistent with how Tools and MCP server changes already invalidate a completed Preview.

#### Scenario: Linking a knowledge base after a successful preview
- **WHEN** the user has completed a successful Preview and then links or unlinks a knowledge base
- **THEN** the Preview is invalidated and a new Preview is required before Go Live is available again

## ADDED Requirements

### Requirement: Link Existing Knowledge Base
The system SHALL allow the user to link one or more existing knowledge bases to the agent from the Playground editor, choosing from knowledge bases not already linked.

#### Scenario: Linking an existing knowledge base
- **WHEN** the user opens "Link existing" and selects a knowledge base not already linked
- **THEN** that knowledge base appears in the agent's linked list

### Requirement: Create Knowledge Base Inline From Playground
The system SHALL allow the user to create a new knowledge base directly from the Playground editor by providing a name, which SHALL simultaneously create it (visible on the global Knowledge Base page) and link it to the current agent.

#### Scenario: Creating a knowledge base from Playground
- **WHEN** the user provides a name via "Create new" in the linked-knowledge-bases panel and confirms
- **THEN** a new knowledge base is created, appears on the global Knowledge Base list, and is linked to the current agent

### Requirement: Unlink Knowledge Base
The system SHALL allow the user to unlink a knowledge base from the agent without deleting the knowledge base itself or affecting other agents that link to it.

#### Scenario: Unlinking a knowledge base
- **WHEN** the user unlinks a knowledge base that is also linked to another agent
- **THEN** the knowledge base is removed from the current agent's linked list, but remains linked to the other agent and still exists on the global Knowledge Base page

### Requirement: Manage Linked Knowledge Base Entries Inline
The system SHALL allow the user to expand any linked knowledge base within the Playground editor and manage its files/URLs inline, per the `agent-knowledge-base` capability. Changes SHALL apply to the shared knowledge base immediately and be visible to every other agent that links to it.

#### Scenario: Editing a shared knowledge base's files from one agent's editor
- **WHEN** the user expands a linked knowledge base in Playground and adds a file to it
- **THEN** the file appears in that knowledge base's entries for every agent that links to it, not just the one being edited
