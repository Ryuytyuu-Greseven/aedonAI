# Capability: Tools Management

## Purpose

Tools in LyreAI are reusable function definitions that nodes can invoke during LLM execution (equivalent to LangGraph tool bindings). Tools Management provides a dedicated workspace — separate from node editing — where users can create, configure, edit, and delete tools at the agent level. All tools created belong to the agent and are stored in the top-level `tools` array of the agent JSON.

---

## Requirements

### Requirement: Tools List View

The system SHALL display all tools created under the current agent in a list or card grid within the Tools tab. Each entry SHALL show: tool name, description excerpt, and which nodes reference it (as a tag list or count badge).

#### Scenario: Tools tab with existing tools
- **WHEN** the user navigates to the Tools tab
- **THEN** all agent-level tools are listed with their names, descriptions, and node reference counts

#### Scenario: Empty tools state
- **WHEN** no tools have been created yet
- **THEN** an empty-state message "No tools yet. Create your first tool." with an "Add Tool" button is displayed

---

### Requirement: Create Tool

The system SHALL allow the user to create a new tool by clicking "Add Tool". Each tool SHALL have: `id` (auto-generated, UUID), `name` (required, unique within agent), `description` (required — used as the function description sent to the LLM), `parameters` (JSON schema object — a key-value list of parameter name + type + description), and `returns` (description of return value, optional).

#### Scenario: Creating a tool with required fields
- **WHEN** the user fills in name and description and clicks "Save Tool"
- **THEN** the tool is added to the agent's `tools` array with an auto-generated ID, and it appears in the tools list

#### Scenario: Duplicate tool name
- **WHEN** the user enters a tool name that already exists in the agent
- **THEN** inline validation shows "A tool with this name already exists" and prevents save

#### Scenario: Creating a tool with parameters
- **WHEN** the user adds one or more parameters (name, type, description)
- **THEN** each parameter is stored in the tool's `parameters` object and is displayed in a key-value table in the tool detail view

---

### Requirement: Bulk Tool Creation

The system SHALL allow the user to create multiple tools in one session without closing the creation form after each save. A "Save and Add Another" button SHALL keep the form open and reset it after saving.

#### Scenario: Adding multiple tools in sequence
- **WHEN** the user clicks "Save and Add Another" after filling in a tool
- **THEN** the tool is saved, the form clears, and the user can immediately enter the next tool's details; the saved tool appears in the background list

---

### Requirement: Edit Tool

The system SHALL allow the user to open an existing tool for editing by clicking its card or an Edit action. Saving an edited tool updates all in-memory node references (tool IDs remain stable; only editable fields change).

#### Scenario: Editing a tool name
- **WHEN** the user renames a tool and saves
- **THEN** the tool's name updates in the tools list and in the node panel tags wherever it is assigned; the tool ID does not change

#### Scenario: Editing tool parameters
- **WHEN** the user adds or removes parameters from an existing tool
- **THEN** the `parameters` object in the agent JSON is updated to reflect the new schema

---

### Requirement: Delete Tool

The system SHALL allow the user to delete a tool. If the tool is assigned to one or more nodes, a warning SHALL list those nodes before confirmation. Deleting removes the tool from the agent `tools` array and removes its ID from any node's `tools` array.

#### Scenario: Deleting an assigned tool
- **WHEN** the user deletes a tool that is referenced by 2 nodes
- **THEN** a modal warns "This tool is used in: Node A, Node B. Deleting it will remove it from those nodes." On confirmation, the tool is deleted and both nodes' `tools` arrays are updated

#### Scenario: Deleting an unassigned tool
- **WHEN** the user deletes a tool not referenced by any node
- **THEN** a simple confirmation dialog appears; on confirm, the tool is removed without additional warning

---

### Requirement: Tool Parameter Schema Builder

The system SHALL provide a dynamic form to define tool parameters without requiring the user to write raw JSON. Each parameter SHALL have: name, data type (string / number / boolean / array / object), description, and required flag.

#### Scenario: Adding a parameter
- **WHEN** the user clicks "Add Parameter" and fills in the fields
- **THEN** a new row appears in the parameters table with the entered values, and the corresponding JSON schema entry is generated automatically

#### Scenario: Removing a parameter
- **WHEN** the user clicks the remove icon on a parameter row
- **THEN** the row is removed and the JSON schema updates accordingly
