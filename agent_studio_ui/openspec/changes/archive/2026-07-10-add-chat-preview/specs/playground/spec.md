## ADDED Requirements

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
