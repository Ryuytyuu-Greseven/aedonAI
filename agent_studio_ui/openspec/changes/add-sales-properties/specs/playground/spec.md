## ADDED Requirements

### Requirement: Properties Side Panel
The system SHALL show a Properties section in the editor sidebar, positioned after the Knowledge Base section, only for agents whose template is `real_estate_sales`. Managing properties here is independent of the agent's own draft/save flow — see the `sales-properties` capability for the full add/edit/delete behavior.

#### Scenario: Properties section only for Real Estate Sales
- **WHEN** the current template's id is `real_estate_sales`
- **THEN** the sidebar shows both the Knowledge Base section and, below it, the Properties section

#### Scenario: No Properties section for other templates
- **WHEN** the current template's id is anything other than `real_estate_sales`
- **THEN** the sidebar shows only the Knowledge Base section, with no Properties section
