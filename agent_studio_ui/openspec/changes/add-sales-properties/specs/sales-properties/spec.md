## ADDED Requirements

### Requirement: Properties Section Is Template-Gated
The system SHALL show a "Properties" section in the Playground editor sidebar only when the agent's template is `real_estate_sales`, and SHALL NOT show it for any other template.

#### Scenario: Real Estate Sales agent
- **WHEN** the loaded or selected template's id is `real_estate_sales`
- **THEN** the Properties section is visible in the sidebar, alongside Knowledge Base

#### Scenario: Any other template
- **WHEN** the loaded or selected template's id is anything other than `real_estate_sales` (including no template selected)
- **THEN** the Properties section is not rendered at all

### Requirement: Properties Require a Saved Agent
The system SHALL require a real, saved agent (a real `agentId`) before Properties can be added, edited, or deleted, since each Property is persisted immediately against that agent's id.

#### Scenario: Agent not yet saved
- **WHEN** the Properties section is shown for a new agent draft that has never been saved
- **THEN** the section renders in a disabled state with a note explaining the agent must be saved first, and no Add/Edit/Delete action is available

#### Scenario: Agent has been saved
- **WHEN** the agent has a real id (already saved at least once)
- **THEN** the Properties section is fully interactive: existing properties load and Add/Edit/Delete are available

### Requirement: List Properties For This Agent
The system SHALL list all properties belonging to the current agent, newest first, fetched via `GET /api/sales/properties?agentId=`.

#### Scenario: Agent has properties
- **WHEN** the agent has one or more properties
- **THEN** each is listed showing its name and a preview of its description

#### Scenario: Agent has no properties
- **WHEN** the agent has zero properties
- **THEN** an empty state is shown instead of an empty list, with no error

### Requirement: Add a Property
The system SHALL let the user add a property with a required `name` and optional free-text `description`, persisted via `POST /api/sales/properties`.

#### Scenario: Successful add
- **WHEN** the user submits the Add Property form with a non-empty name
- **THEN** the property is created against the current agent, the list updates to include it, and a success toast is shown

#### Scenario: Empty name rejected
- **WHEN** the user submits the form with an empty name
- **THEN** the request is not sent and an inline validation error is shown

### Requirement: Edit a Property
The system SHALL let the user edit an existing property's `name` and/or `description`, persisted via `PATCH /api/sales/properties/:id`.

#### Scenario: Successful edit
- **WHEN** the user changes a property's name and/or description and saves
- **THEN** the update is sent for just that property, the list reflects the new values, and a success toast is shown

### Requirement: Delete a Property Is Confirmed and Irreversible
The system SHALL require explicit confirmation before deleting a property (`DELETE /api/sales/properties/:id`), and SHALL make clear in that confirmation that the action cannot be undone.

#### Scenario: Confirmed delete
- **WHEN** the user confirms deleting a property
- **THEN** the property is permanently deleted, removed from the list, and a success toast is shown

#### Scenario: Cancelled delete
- **WHEN** the user dismisses the delete confirmation without confirming
- **THEN** no request is sent and the property remains in the list
