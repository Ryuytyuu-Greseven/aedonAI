# Capability: Templates

## Purpose

Read-only access to the 5 fixed in-house agent templates offered by the Playground template picker. Backs `AgentTemplateService`. Implemented per `../builder_config/backend-openspec/specs/templates/spec.md`.

---

## Requirements

### Requirement: List Templates
The system SHALL provide the 5 fixed templates (Real Estate Sales, Survey, Contact Centre, Alerting, General), seeded into the database at startup rather than hardcoded in the frontend.

#### Scenario: Fetching all templates
- **WHEN** `GET /api/templates` is called by an authenticated user
- **THEN** the system returns all 5 templates as an array

### Requirement: Get Template By Id
The system SHALL return a single template by its `template_id`, or a clean 404 if it doesn't exist.

#### Scenario: Existing template
- **WHEN** `GET /api/templates/:id` is called with a valid `template_id`
- **THEN** the system returns `200` with that template

#### Scenario: Unknown template
- **WHEN** `GET /api/templates/:id` is called with an id that doesn't match any template
- **THEN** the system returns `404`

### Requirement: Referral Bonus Eligibility
The system SHALL mark exactly one seeded template (`real_estate_sales`) as `referral_bonus_eligible: true`; all others `false`. This flag is read by the Agents capability to enforce whether an agent may carry a `referral_bonus`.

#### Scenario: Idempotent seeding
- **WHEN** the server restarts against a database that already has the 5 templates
- **THEN** no duplicate templates are created and existing rows are left untouched (seed uses `$setOnInsert`)
