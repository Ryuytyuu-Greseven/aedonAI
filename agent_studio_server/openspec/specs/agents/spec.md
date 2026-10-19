# Capability: Agents

## Purpose

CRUD, cloning, status transitions, and the preview-call action for the `Agent` resource — the largest and most-used surface, behind the Dashboard, the Playground editor, and Monitor Agents (reads). Backs `AgentService`. Implemented per `../builder_config/backend-openspec/specs/agents/spec.md`.

`nodes`/`tools` fields are kept in the schema and API responses even though the active Playground flow never populates `nodes` — they're inherited from a dormant free-form "Agent Builder" mode that may be revived later.

---

## Requirements

### Requirement: Agent CRUD
The system SHALL support creating, reading, updating, and deleting agents, with server-assigned `id`, `created_at`, `updated_at`.

#### Scenario: Creating an agent from a template
- **WHEN** `POST /api/agents` is called with `agent_name`, `greeting`, `prompt`, `behavior`, `tools`, `base_template_id`
- **THEN** the system creates the agent with `status: "draft"` (unless overridden), assigns ids to any tool/node missing one, and returns `201`

#### Scenario: Editing a live agent
- **WHEN** `PATCH /api/agents/:id` is called on an `active` agent with field changes but no `status` change
- **THEN** the changes persist and `status` remains `active`

#### Scenario: Deleting an agent
- **WHEN** `DELETE /api/agents/:id` is called with a valid id
- **THEN** the system returns `204` and the agent no longer appears in `GET /api/agents`

#### Scenario: Unknown agent
- **WHEN** any single-agent endpoint is called with an id that doesn't exist
- **THEN** the system returns `404`

### Requirement: Template-Default Fallback
The system SHALL substitute the referenced template's defaults for any blank `agent_name`/`greeting`/`prompt`/`behavior` field on create or update, as defense-in-depth against clients that don't replicate the frontend's own substitution.

#### Scenario: Blank prompt on create
- **WHEN** `POST /api/agents` is called with `base_template_id` set and `prompt: ""`
- **THEN** the created agent's `prompt` is the referenced template's `default_prompt`

### Requirement: Referral Bonus Eligibility Enforcement
The system SHALL only persist `referral_bonus` on an agent whose `base_template_id` resolves to a template with `referral_bonus_eligible: true`; otherwise it is silently dropped.

#### Scenario: Bonus on an ineligible template
- **WHEN** an agent is created or updated with `referral_bonus` set but its `base_template_id` resolves to a non-eligible template (or no template)
- **THEN** the system persists the agent without `referral_bonus`

### Requirement: Server-Side Clone Naming
The system SHALL name a clone `<base name> Clone <n>`, computed atomically server-side, immune to a race between two near-simultaneous clone requests of the same source producing colliding names.

#### Scenario: Cloning a clone
- **WHEN** "Weekend Survey Line Clone 2" is cloned
- **THEN** the result is named "Weekend Survey Line Clone 3" (existing suffix stripped before appending)

#### Scenario: Concurrent clone requests
- **WHEN** two clone requests for the same source agent arrive nearly simultaneously
- **THEN** each gets a distinct, sequential clone number — enforced via a unique index on `(clone_base_name, clone_number)` with retry-on-conflict, not an in-memory scan

#### Scenario: Clone status
- **WHEN** any agent, regardless of its own status, is cloned
- **THEN** the resulting clone always has `status: "draft"` and a fresh `id`/`created_at`/`updated_at`

### Requirement: Preview
The system SHALL generate a transcript for an agent and record a hash of its current customization fields, to be checked by the Go Live gate.

#### Scenario: Preview call
- **WHEN** `POST /api/agents/:id/preview` is called
- **THEN** the system returns `200 { transcript }` and stores `preview_hash = hash(greeting + prompt + behavior + tools)` on the agent

### Requirement: Go Live Requires A Fresh Preview
The system SHALL only allow a `draft` agent to transition to `active` if its current fields still match the hash recorded by the most recent preview; a stale preview must reject the transition.

#### Scenario: Go Live after preview, no further edits
- **WHEN** `PATCH /api/agents/:id { status: "active" }` is called on a `draft` agent whose current fields hash to its stored `preview_hash`
- **THEN** the system transitions the agent to `active`

#### Scenario: Go Live after an un-previewed edit
- **WHEN** an agent's `greeting`/`prompt`/`behavior`/`tools` are edited after the last preview, then `PATCH /api/agents/:id { status: "active" }` is called
- **THEN** the system rejects with `409` and does not change status (other field changes in the same request, if any, still persist)

#### Scenario: Draft agent targeted at any status other than active
- **WHEN** `PATCH /api/agents/:id { status: "inactive" }` (or any non-`active` status) is called on a `draft` agent
- **THEN** the system rejects with `409` ("Draft agents must go live from the Playground")

### Requirement: Active/Inactive Toggle
The system SHALL freely allow `active` ↔ `inactive` transitions in either direction with no additional gate.

#### Scenario: Deactivating a live agent
- **WHEN** `PATCH /api/agents/:id { status: "inactive" }` is called on an `active` agent
- **THEN** the system transitions it to `inactive`

---

## Open decisions (unchanged from backend-openspec)

- Whether the dormant `nodes`/`tools` free-form Agent Builder mode ever gets a real editing backend, or stays permanently unused.
- Whether `PATCH /api/agents/:id/status` should be split out from the generic `PATCH /api/agents/:id` — kept generic for now.
