# Capability: Static Agent Catalog

## Purpose

The Static Agent Catalog is the fixed set of in-house voice agent templates (Real Estate Sales, Survey, Contact Centre, Alerting, General) that the Playground uses as starting points. It is a read-only data source consumed by the Playground; it owns no UI of its own.

---

## Requirements

### Requirement: Fixed Template Catalog
The system SHALL provide a fixed catalog of exactly 5 in-house agent templates: Real Estate Sales, Survey, Contact Centre, Alerting, and General. Each template SHALL define a unique `template_id`, display name, description, default prompt, default greeting, and default behavior configuration. The catalog SHALL be served from a dedicated mocks file, not hand-written inline in components.

#### Scenario: Loading the catalog
- **WHEN** the Playground template picker requests the catalog
- **THEN** a mock API call returns all 5 templates with their default configuration, sourced from a single mocks file

#### Scenario: Catalog is read-only
- **WHEN** any part of the application requests the catalog
- **THEN** the returned templates are immutable defaults; customizing an agent created from a template never mutates the catalog entry itself

### Requirement: Sales Template Marks Referral Eligibility
The system SHALL flag the Real Estate Sales template as the only template eligible for referral bonus configuration, so the Playground can conditionally show that field.

#### Scenario: Selecting the Sales template
- **WHEN** the user selects the Real Estate Sales template in the Playground
- **THEN** the resulting agent configuration is marked referral-bonus-eligible for later phases to read

#### Scenario: Selecting a non-Sales template
- **WHEN** the user selects any template other than Real Estate Sales
- **THEN** the resulting agent configuration is not referral-bonus-eligible
