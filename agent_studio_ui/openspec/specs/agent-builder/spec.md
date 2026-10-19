# Capability: Agent Builder

## Purpose

The Agent Builder is the primary workspace for creating and editing a AedonAI agent. It acts as the shell that ties together Node Management, the Flow Editor, Tools Management, Version History, and the Testing Console into a single cohesive experience. The builder is responsible for the agent-level configuration (name, voice enablement) and for producing and saving the canonical agent JSON.

---

## Requirements

### Requirement: Agent Metadata Form

The system SHALL provide form fields for the agent's top-level configuration: `agent_name` (text input, required) and `enable_voice` (toggle switch). These fields SHALL be visible at all times while editing and SHALL reflect the current agent state.

#### Scenario: Creating a new agent
- **WHEN** the user opens the builder via `/agents/new`
- **THEN** `agent_name` is empty, `enable_voice` defaults to `false`, and the node canvas is empty

#### Scenario: Editing an existing agent
- **WHEN** the user opens the builder via `/agents/:id`
- **THEN** `agent_name` and `enable_voice` are pre-populated from mock data and the existing nodes and tools are rendered on the canvas

#### Scenario: Empty agent name on save
- **WHEN** the user attempts to save with an empty `agent_name`
- **THEN** inline validation prevents save and shows "Agent name is required" beneath the field

---

### Requirement: Agent JSON Export

The system SHALL compute and expose the full canonical agent JSON at any time. The JSON structure SHALL be:

```json
{
  "agent_name": "<string>",
  "enable_voice": "<boolean>",
  "nodes": [
    {
      "id": "<string>",
      "name": "<string>",
      "tools": ["<tool_id>", "..."],
      "prompt": "<string>",
      "nextNode": "<node_id | null>",
      "previousNode": "<node_id | null>"
    }
  ],
  "tools": ["<tool objects>"]
}
```

The export SHALL be accessible via a "View JSON" panel and a "Download JSON" button.

#### Scenario: Viewing JSON mid-edit
- **WHEN** the user opens the "View JSON" panel
- **THEN** the panel shows the current in-memory agent state as formatted JSON, updating live as the user edits nodes or tools

#### Scenario: Downloading JSON
- **WHEN** the user clicks "Download JSON"
- **THEN** a `.json` file named `<agent_name>.json` is downloaded with the current agent state

---

### Requirement: Save Agent

The system SHALL provide a "Save" action that persists the current agent state via a mock POST (new) or PATCH (existing) API call. The save state (saved / unsaved changes) SHALL be indicated in the UI.

#### Scenario: Saving a new agent
- **WHEN** the user clicks "Save" on a new agent with a valid name and at least one node
- **THEN** a mock POST is fired, the agent is assigned a mock ID, the URL updates to `/agents/:id`, and a success toast is shown

#### Scenario: Unsaved changes indicator
- **WHEN** the user modifies any field after the last save
- **THEN** a visual indicator (e.g., "• Unsaved changes") appears in the header until the next successful save

#### Scenario: Save on existing agent
- **WHEN** the user clicks "Save" on an existing agent
- **THEN** a mock PATCH is fired with the full updated agent JSON and a success toast is shown

---

### Requirement: Builder Tab Navigation

The system SHALL provide a tabbed interface within the builder to switch between the main views: **Flow Editor** (default), **Tools**, **Version History**, and **Testing Console**. Switching tabs SHALL preserve the in-memory state of the current agent.

#### Scenario: Switching to Tools tab
- **WHEN** the user clicks the "Tools" tab
- **THEN** the Flow Editor canvas is hidden and the Tools Management panel is shown; the current node/tool state is not lost

#### Scenario: Switching back to Flow Editor
- **WHEN** the user clicks the "Flow" tab after visiting another tab
- **THEN** the canvas re-renders with the same node positions and connections as before the tab switch

---

### Requirement: Breadcrumb and Navigation

The system SHALL display a breadcrumb trail: **Dashboard > Agents > `<agent_name>`**. Clicking "Dashboard" navigates back with a check for unsaved changes.

#### Scenario: Navigating away with unsaved changes
- **WHEN** the user clicks "Dashboard" in the breadcrumb with unsaved changes
- **THEN** a confirmation dialog warns about losing changes; if confirmed, navigation proceeds; if cancelled, the user stays on the builder
