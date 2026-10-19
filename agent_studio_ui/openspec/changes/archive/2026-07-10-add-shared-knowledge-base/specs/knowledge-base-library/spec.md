## ADDED Requirements

### Requirement: Knowledge Base List
The system SHALL display a list of all knowledge bases at `/knowledge-base`, each showing its name, entry count, and how many agents currently use it, with a "Create Knowledge Base" action.

#### Scenario: Viewing existing knowledge bases
- **WHEN** the user opens the Knowledge Base page
- **THEN** every knowledge base is listed with its name, entry count, and linked-agent count

#### Scenario: No knowledge bases yet
- **WHEN** no knowledge base has been created
- **THEN** an empty state is shown with a "Create Knowledge Base" action

### Requirement: Create Knowledge Base
The system SHALL allow the user to create a new, empty knowledge base by providing a name/label, reachable from both the Knowledge Base list page and the Playground editor.

#### Scenario: Creating from the Knowledge Base list page
- **WHEN** the user provides a name and confirms "Create Knowledge Base" on the list page
- **THEN** a new empty knowledge base is created and the user is taken to its detail view

#### Scenario: Duplicate knowledge base name
- **WHEN** the user provides a name matching an existing knowledge base (case-insensitive)
- **THEN** an inline error is shown and no duplicate is created

### Requirement: Knowledge Base Detail View
The system SHALL provide a detail view at `/knowledge-base/:id` showing the knowledge base's name, its full entry list (managed per the `agent-knowledge-base` capability), and the list of agents currently linked to it.

#### Scenario: Viewing linked agents
- **WHEN** the user opens a knowledge base's detail view and it is linked to 2 agents
- **THEN** both agents are listed by name, each linking to that agent's Playground editor

#### Scenario: Viewing a knowledge base linked to no agents
- **WHEN** the user opens a knowledge base's detail view and no agent currently links to it
- **THEN** the linked-agents section shows an empty state rather than an error

### Requirement: Delete Knowledge Base
The system SHALL allow the user to delete a knowledge base from its detail view, gated by a confirmation dialog that states how many agents currently link to it. Deleting SHALL unlink it from every agent that referenced it.

#### Scenario: Deleting an unused knowledge base
- **WHEN** the user deletes a knowledge base linked to no agents and confirms
- **THEN** the knowledge base is removed from the list

#### Scenario: Deleting a knowledge base linked to agents
- **WHEN** the user deletes a knowledge base linked to 2 agents and confirms
- **THEN** the knowledge base is removed, and both agents' linked-knowledge-base lists no longer include it
