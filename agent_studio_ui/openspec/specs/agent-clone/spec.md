# Capability: Agent Clone

## Purpose

Agent Clone lets a customer duplicate an existing agent — draft, active, or inactive — into a new draft, instead of starting over from a template every time. Available from both the Dashboard and the Playground editor.

---

## Requirements

### Requirement: Clone Agent
The system SHALL allow the user to clone any agent, regardless of its status (`draft`, `active`, or `inactive`) or origin, via a mock API call. The clone SHALL be created with status `draft`, copy all of the source agent's customization fields (name basis, greeting, prompt, behavior, `enable_voice`, `tools`, `base_template_id`), and be assigned a new id.

#### Scenario: Cloning a live agent
- **WHEN** the user clones an agent with status `active`
- **THEN** a new agent is created with status `draft`, copying the source agent's configuration and tools

#### Scenario: Cloning a draft agent
- **WHEN** the user clones an agent with status `draft`
- **THEN** a new agent is created with status `draft`, copying the source agent's configuration and tools

### Requirement: Clone Naming
The system SHALL name a clone `<base name> Clone <n>`, where `<base name>` is the source agent's name with any existing `" Clone <n>"` suffix stripped, and `<n>` is one greater than the highest existing clone number found among agents sharing that base name.

#### Scenario: First clone of an agent
- **WHEN** the user clones "Weekend Survey Line" and no clones of it exist yet
- **THEN** the new agent is named "Weekend Survey Line Clone 1"

#### Scenario: Cloning again
- **WHEN** the user clones "Weekend Survey Line" again after "Weekend Survey Line Clone 1" already exists
- **THEN** the new agent is named "Weekend Survey Line Clone 2"

#### Scenario: Cloning a clone
- **WHEN** the user clones "Weekend Survey Line Clone 2"
- **THEN** the new agent is named "Weekend Survey Line Clone 3", not "Weekend Survey Line Clone 2 Clone 1"
