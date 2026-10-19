# Capability: Node Management

## Purpose

Each node in a AedonAI agent maps directly to a LangGraph node in the agent's execution graph. Node Management covers creating, editing, deleting, and configuring individual nodes — including the system prompt that governs the node's LLM behaviour and the subset of tools assigned to that node. Node data is part of the agent JSON and is persisted through the Agent Builder's save mechanism.

---

## Requirements

### Requirement: Create Node

The system SHALL allow the user to add a new node to the current agent by clicking an "Add Node" button. A new node SHALL be created with a default name, an empty prompt, and no tools assigned. The node SHALL appear on the flow canvas immediately.

#### Scenario: Adding the first node
- **WHEN** the user clicks "Add Node" on an empty canvas
- **THEN** a node card appears on the canvas with an auto-generated name (e.g., "Node 1") and default empty configuration

#### Scenario: Adding subsequent nodes
- **WHEN** the user clicks "Add Node" with existing nodes present
- **THEN** a new node card appears with an incremented default name and is positioned to the right of or below the last node

---

### Requirement: Node Configuration Panel

The system SHALL provide a configuration side panel or modal that opens when the user clicks a node. The panel SHALL expose: node name (editable), system prompt (multi-line textarea), and assigned tools (multi-select from the agent's tool list).

#### Scenario: Opening a node panel
- **WHEN** the user clicks on a node card on the canvas
- **THEN** a side panel slides in (or a modal opens) showing the node's current name, prompt, and selected tools

#### Scenario: Editing node name
- **WHEN** the user changes the node name in the panel
- **THEN** the node card on the canvas updates the displayed name in real time

#### Scenario: Editing system prompt
- **WHEN** the user types in the prompt textarea
- **THEN** the text is saved to the in-memory node state immediately (no explicit "Apply" needed); the change is reflected in the JSON preview

---

### Requirement: Node Prompt

The system SHALL provide a rich textarea for the node's system prompt that supports at minimum: plain text editing, copy/paste, and character count. The prompt SHALL be treated as plain text (no markdown rendering at input time).

#### Scenario: Long prompt entry
- **WHEN** the user pastes a prompt longer than 500 characters
- **THEN** the textarea scrolls internally, character count updates, and no truncation occurs

#### Scenario: Empty prompt warning
- **WHEN** the user saves the agent with a node whose prompt is empty
- **THEN** a non-blocking warning toast indicates "Node '<name>' has no prompt configured" but does not prevent save

---

### Requirement: Assign Tools to Node

The system SHALL allow the user to assign zero or more tools (from the agent's global tool list) to each node via a multi-select list or checkbox group within the node configuration panel. The node JSON `tools` array SHALL contain only the IDs of assigned tools.

#### Scenario: Assigning a tool
- **WHEN** the user selects a tool from the multi-select within the node panel
- **THEN** the tool ID is added to the node's `tools` array and the tool name appears as a tag on the node card on the canvas

#### Scenario: Removing a tool assignment
- **WHEN** the user deselects a tool from the multi-select
- **THEN** the tool ID is removed from the node's `tools` array and the tag disappears from the canvas node card

#### Scenario: No tools available
- **WHEN** the agent has no tools created yet and the user opens the node panel
- **THEN** the tool selection area shows "No tools created yet. Go to the Tools tab to add tools." with a link to the Tools tab

---

### Requirement: Delete Node

The system SHALL allow the user to delete a node via a delete icon or contextual menu on the node card. Deleting a node SHALL also remove all graph edges (connections) associated with that node and clean up `nextNode`/`previousNode` references in adjacent nodes.

#### Scenario: Deleting a connected node
- **WHEN** the user deletes a node that is connected to other nodes
- **THEN** the edge(s) connecting it are removed, and the previously connected nodes have their `nextNode` or `previousNode` set to `null`

#### Scenario: Deleting the only node
- **WHEN** the user deletes the only node on the canvas
- **THEN** the canvas returns to its empty state with the "Add Node" prompt visible

---

### Requirement: Duplicate Node

The system SHALL allow the user to duplicate a node via a contextual action. The duplicate SHALL copy the name (appended with "Copy"), prompt, and tool assignments but SHALL have no graph connections.

#### Scenario: Duplicating a node
- **WHEN** the user clicks "Duplicate" on a node
- **THEN** a new node appears on the canvas with name "<original> Copy", the same prompt text, and the same tool assignments, but no edges
