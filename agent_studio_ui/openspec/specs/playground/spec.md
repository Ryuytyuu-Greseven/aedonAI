# Capability: Playground

## Purpose

The Playground is the primary agent-creation and editing surface for general customers: pick one of the fixed in-house templates from the Static Agent Catalog, customize its prompt/greeting/behavior, and move it through Draft and Live states. It replaces the free-form Agent Builder as the active creation path; no node/flow editing is available here.

---

## Requirements

### Requirement: Template Selection
The system SHALL present all templates from the static agent catalog as selectable cards at `/playground/new`. Selecting a template SHALL initialize a new agent pre-filled with that template's default name, greeting, prompt, and behavior, and marked `enable_voice: true` by default.

#### Scenario: Starting a new agent from a template
- **WHEN** the user selects a template card
- **THEN** the Playground editor opens with all fields pre-populated from that template's defaults and `enable_voice` set to `true`

### Requirement: Customize Agent Configuration
The system SHALL allow the user to edit the agent's display name, call greeting, behavior prompt, and behavior configuration for any template-based agent. Fields left unedited SHALL retain the template's default value.

#### Scenario: Editing the greeting
- **WHEN** the user changes the greeting field and saves
- **THEN** the saved agent uses the custom greeting on subsequent loads instead of the template default

#### Scenario: Leaving a field untouched
- **WHEN** the user saves without editing the prompt field
- **THEN** the saved agent's prompt equals the template's default prompt

### Requirement: Reset to Template Default
The system SHALL provide a reset action, available per-field and for the whole agent, that restores the template's default value(s), discarding any customization.

#### Scenario: Resetting a single field
- **WHEN** the user clicks "Reset" next to the greeting field
- **THEN** only the greeting field reverts to the template default; other customized fields are unaffected

#### Scenario: Resetting the whole agent
- **WHEN** the user clicks "Reset to default" at the agent level
- **THEN** name, greeting, prompt, and behavior configuration all revert to the selected template's defaults

### Requirement: Draft and Live State
The system SHALL support two states for a Playground agent: `draft` and `active` (Live). Saving without explicitly marking an agent Live SHALL keep it in `draft`. An explicit "Go Live" action SHALL transition a `draft` agent to `active`, gated by a confirmation modal. "Go Live" SHALL only be reachable after a successful Preview in the current editing session, per the `agent-preview-call` capability; any subsequent edit invalidates that preview and requires a new one.

#### Scenario: Saving a new customization
- **WHEN** the user saves a template customization for the first time
- **THEN** the agent is created with status `draft` via a mock API call

#### Scenario: Go Live unavailable without a preview
- **WHEN** the user has not completed a successful Preview in this editing session
- **THEN** the "Go Live" action is disabled or hidden, even for a `draft` agent

#### Scenario: Requesting to go live after a successful preview
- **WHEN** the user has completed a successful Preview and clicks "Go Live" on a `draft` agent
- **THEN** a confirmation modal asks the user to confirm making the agent live

#### Scenario: Confirming go live
- **WHEN** the user confirms the "Go Live" modal
- **THEN** a mock API call transitions the agent's status to `active`

#### Scenario: Cancelling go live
- **WHEN** the user dismisses or cancels the "Go Live" confirmation modal
- **THEN** no API call is made and the agent remains `draft`

#### Scenario: Editing a Live agent
- **WHEN** the user edits and saves a Live (`active`) agent
- **THEN** the changes are persisted and the agent remains `active` (editing does not revert it to `draft`)

### Requirement: Preview Tab Modes
The system SHALL present the Playground editor's Preview tab as two sub-tabs, "Call" and "Chat", per the `agent-preview-call` and `agent-preview-chat` capabilities respectively. Switching between them SHALL NOT affect the agent's other saved data.

#### Scenario: Switching preview modes
- **WHEN** the user switches from the Call sub-tab to the Chat sub-tab (or back)
- **THEN** the other tabs' content (Build, Integrations, MCP Servers) and the agent's saved fields are unaffected

### Requirement: Preview Gates Go Live
The system SHALL only allow the "Go Live" action once a Call preview or a Chat preview for the current `draft` agent has completed successfully in the current editing session — either mode satisfies the requirement. Any subsequent change to the agent's customization fields, tools/integrations, MCP servers, or knowledge base links SHALL invalidate the passed preview, requiring a new successful Call or Chat preview before Go Live is reachable again.

#### Scenario: Go Live unavailable before any completed preview
- **WHEN** the user opens a `draft` agent that has not had a successful Call or Chat preview in this session
- **THEN** the "Go Live" action is disabled or hidden

#### Scenario: Go Live available after a successful Call preview
- **WHEN** the active Call preview ends with outcome `completed`
- **THEN** the "Go Live" action becomes available

#### Scenario: Go Live available after a successful Chat preview
- **WHEN** the user ends a Chat preview session that had at least one real exchange
- **THEN** the "Go Live" action becomes available

#### Scenario: Go Live unavailable after a failed Call preview
- **WHEN** the active Call preview ends with outcome `failed`
- **THEN** the "Go Live" action remains disabled or hidden (a failed Call preview does not satisfy the gate, and Chat has no failure outcome)

#### Scenario: Editing after a successful preview invalidates it
- **WHEN** the user edits any field, tool/integration, MCP server, or knowledge base link after a successful Call or Chat preview
- **THEN** "Go Live" becomes unavailable again until a new Call or Chat preview completes successfully

### Requirement: Drafted Agents List
The system SHALL list all `draft`-status Playground agents in a dedicated "Drafted" section within the Playground, separate from the main Dashboard's full agent list.

#### Scenario: Viewing drafts
- **WHEN** the user opens the Playground's Drafted section
- **THEN** all agents with status `draft` are listed with their template name and last-modified time

### Requirement: Default Fallback Behavior
The system SHALL apply the template's default name, greeting, and prompt whenever the corresponding customization field is empty, ensuring an agent is never created with a blank behavior definition.

#### Scenario: Blank custom greeting
- **WHEN** the user clears the greeting field entirely and saves
- **THEN** the system falls back to the template's default greeting for that agent rather than saving an empty value

### Requirement: Cancel Editing
The system SHALL provide a "Cancel" action in the Playground editor that discards in-progress edits and navigates away without saving.

#### Scenario: Cancel a not-yet-saved new agent
- **WHEN** the user clicks "Cancel" while customizing a template that has not yet been saved
- **THEN** the system navigates back to the template picker (`/playground/new`) without creating an agent

#### Scenario: Cancel while editing an existing agent
- **WHEN** the user clicks "Cancel" while editing an already-saved agent
- **THEN** the system navigates to the Dashboard without persisting any unsaved field changes

### Requirement: Export Destinations Section
The system SHALL provide an Export Destinations section within the Playground editor where the user can add, edit, and remove destinations per the `export-destinations` capability.

#### Scenario: Managing destinations while editing an agent
- **WHEN** the user opens the Export Destinations section of the Playground editor
- **THEN** the agent's current destinations are listed, with controls to add, edit, or remove them, consistent with the `export-destinations` capability

### Requirement: MCP Servers Section
The system SHALL provide an "MCP Servers" section within the Playground editor, positioned alongside the Export Destinations section, where the user can add, edit, and remove MCP server connection entries per the `mcp-servers` capability.

#### Scenario: Managing MCP servers while editing an agent
- **WHEN** the user opens the MCP Servers section of the Playground editor
- **THEN** the agent's current `mcp_servers` entries are listed, with controls to add, edit, or remove them, consistent with the `mcp-servers` capability

#### Scenario: Persisting MCP servers on save
- **WHEN** the user saves the Playground editor form after adding, editing, or removing MCP server entries
- **THEN** the agent's `mcp_servers` array is included in the persisted agent payload

### Requirement: History Side Panel
The system SHALL provide a "History" toggle in the Playground editor header that opens a side panel listing the agent's version history, per the `version-history` capability. The panel SHALL be reachable regardless of which editor tab (Build, Integrations, MCP Servers, Preview) is currently active, and SHALL NOT require the agent to be on any particular tab to open.

#### Scenario: Opening history from any tab
- **WHEN** the user clicks the "History" toggle while on the Integrations, MCP Servers, or Preview tab
- **THEN** the History side panel opens over the current tab's content without switching tabs

#### Scenario: Viewing history for a Live agent
- **WHEN** the user opens the History side panel for an `active` Playground agent that has been saved multiple times since going live
- **THEN** the panel lists each recorded version, newest first, per the `version-history` capability

#### Scenario: Viewing history for a Draft agent
- **WHEN** the user opens the History side panel for a `draft` Playground agent
- **THEN** the panel shows the empty state indicating history is tracked only once the agent goes live

### Requirement: Knowledge Base Side Panel
The system SHALL render the Playground editor as two columns on wide viewports: the existing tabbed content (Build, Integrations, MCP Servers, Preview) in a left column, and a persistent panel for managing the agent's linked knowledge bases in a right column, per the `knowledge-base-library` and `agent-knowledge-base` capabilities. The panel SHALL be visible regardless of which left-column tab is active, and SHALL NOT be gated behind a tab.

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

### Requirement: Clone Action In Editor
The system SHALL provide a "Clone" action in the Playground editor toolbar for any already-saved agent (draft or live), producing a new draft per the `agent-clone` capability and navigating to it.

#### Scenario: Cloning while editing
- **WHEN** the user clicks "Clone" in the Playground editor for a saved agent
- **THEN** a mock API call creates the clone, and the editor navigates to the new clone's own editor view

### Requirement: Phone Number Assignment
The system SHALL allow the user to assign a dedicated phone number to the agent being configured, from the Basics card of the Build tab. The user SHALL first select a country, then select from that country's `available` phone numbers (per the `phone-number-library` capability), including the agent's currently-assigned number if it belongs to that country.

#### Scenario: Selecting a country lists its available numbers
- **WHEN** the user selects a country in the phone number picker
- **THEN** the number dropdown lists that country's available phone numbers (plus the agent's own currently-assigned number, if it belongs to that country)

#### Scenario: Assigning a number and saving
- **WHEN** the user selects a phone number and saves the agent
- **THEN** the agent is persisted with that phone number assigned, and the number's status becomes `assigned` to this agent

#### Scenario: Changing country clears an incompatible selection
- **WHEN** the user changes the country after already selecting a number from a different country
- **THEN** the number selection is cleared and the dropdown repopulates with the new country's available numbers

#### Scenario: Reassigning frees the previous number
- **WHEN** the user changes the assigned number to a different one and saves
- **THEN** the previously assigned number reverts to `available` status and the newly selected number becomes `assigned` to this agent

#### Scenario: No number assigned
- **WHEN** the user saves an agent without selecting a phone number
- **THEN** the agent is saved with no phone number assigned, unaffected by this requirement

#### Scenario: Cancelling discards the pending assignment
- **WHEN** the user changes the phone number selection and then clicks "Cancel" instead of saving
- **THEN** no phone number assignment change is persisted
