## ADDED Requirements

### Requirement: MCP Servers List View

The system SHALL provide an "MCP Servers" section in the Playground editor that displays all MCP server entries configured for the current agent in a list or card grid. Each entry SHALL show: `name` and `url`. The `api_key`, if set, SHALL be displayed masked (e.g. `••••1234`), never in plaintext.

#### Scenario: MCP Servers section with existing entries
- **WHEN** the user opens the Playground editor for an agent with configured MCP servers
- **THEN** all configured MCP server entries are listed with their name and URL, and any set API key is shown masked

#### Scenario: Empty MCP servers state
- **WHEN** no MCP server entries have been added yet
- **THEN** an empty-state message ("No MCP servers yet. Add your first server connection.") with an "Add MCP Server" button is displayed

---

### Requirement: Add MCP Server

The system SHALL allow the user to add a new MCP server entry by clicking "Add MCP Server". Each entry SHALL have: `id` (auto-generated UUID), `name` (required, unique within the agent), `url` (required), and `api_key` (optional).

#### Scenario: Adding an entry with required fields
- **WHEN** the user fills in `name` and `url` and clicks "Save"
- **THEN** the entry is added to the agent's `mcp_servers` array with an auto-generated ID and appears in the list

#### Scenario: Adding an entry with an API key
- **WHEN** the user fills in `name`, `url`, and enters a value in the API key field
- **THEN** the API key input is masked as the user types (password-style field) and the value is stored on the entry

#### Scenario: Duplicate MCP server name
- **WHEN** the user enters a `name` that already exists among the agent's `mcp_servers`
- **THEN** inline validation shows "An MCP server with this name already exists" and prevents save

#### Scenario: Missing required field
- **WHEN** the user attempts to save without a `name` or without a `url`
- **THEN** inline validation prevents save and identifies the missing field(s)

---

### Requirement: Edit MCP Server

The system SHALL allow the user to open an existing MCP server entry for editing. The `id` SHALL remain stable across edits. The `api_key` field SHALL be pre-rendered masked (not the plaintext value); leaving it unchanged SHALL preserve the existing key, and entering a new value SHALL replace it.

#### Scenario: Editing name or URL
- **WHEN** the user updates `name` or `url` on an existing entry and saves
- **THEN** the entry updates in the list; the `id` does not change

#### Scenario: Replacing an API key
- **WHEN** the user opens an entry with an existing API key, types a new value into the masked API key field, and saves
- **THEN** the entry's `api_key` is updated to the new value

#### Scenario: Leaving API key unchanged
- **WHEN** the user edits `name` or `url` without touching the API key field
- **THEN** the previously stored `api_key` value is preserved unchanged

---

### Requirement: Delete MCP Server

The system SHALL allow the user to delete an MCP server entry. Deleting removes the entry from the agent's `mcp_servers` array.

#### Scenario: Deleting an entry
- **WHEN** the user deletes an MCP server entry and confirms
- **THEN** the entry is removed from the `mcp_servers` array and no longer appears in the list

---

### Requirement: API Key Masking and Redaction

The system SHALL mask the `api_key` value in every UI surface where it is displayed (list view, edit form) within the Playground editor's MCP Servers section. The plaintext `api_key` SHALL never appear in these views once set; re-entering a new value in the edit form is the only way to change it.

#### Scenario: Viewing a configured MCP server's API key
- **WHEN** the user views an MCP server entry that has an `api_key` set, in either the list view or the edit form
- **THEN** the `api_key` is shown in redacted form (e.g. `••••1234`) rather than plaintext

#### Scenario: Editing without changing the API key
- **WHEN** the user edits an MCP server entry's `name` or `url` without entering a new value in the API key field
- **THEN** the previously stored `api_key` is preserved unchanged and is never re-displayed in plaintext
