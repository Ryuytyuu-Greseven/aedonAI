## MODIFIED Requirements

### Requirement: Agent List

The system SHALL display a list of all agents belonging to the current user, showing each agent's name, status (Active / Inactive / Draft), the template it is based on, creation date, last modified date, and whether voice is enabled. The list SHALL be populated from a mock API call on page load.

#### Scenario: Page load with agents
- **WHEN** the Dashboard page loads
- **THEN** a mock API call is made, the response is mapped to the agent list, and agents are rendered as cards/rows within 200 ms of the mock response

#### Scenario: Empty state
- **WHEN** the mock API returns an empty array
- **THEN** an empty-state illustration and a "Create your first agent" call-to-action button are displayed

#### Scenario: Loading state
- **WHEN** the mock API call is in flight
- **THEN** skeleton placeholder cards are shown in place of agent entries

#### Scenario: Draft agent shown in list
- **WHEN** the agent list includes an agent with status `draft`
- **THEN** it is rendered with a "Draft" badge and its originating template name

### Requirement: Active / Inactive Filter

The system SHALL provide a segmented control or tab group that filters the agent list by status: All, Active, Inactive, Draft. The filter SHALL update the list instantly without a new API call.

#### Scenario: Filter to Active
- **WHEN** the user selects the "Active" filter
- **THEN** only agents with `status: "active"` are shown; the count badge on the tab updates accordingly

#### Scenario: Filter to Inactive
- **WHEN** the user selects the "Inactive" filter
- **THEN** only agents with `status: "inactive"` are shown

#### Scenario: Filter to Draft
- **WHEN** the user selects the "Draft" filter
- **THEN** only agents with `status: "draft"` are shown; the count badge on the tab updates accordingly

### Requirement: Agent Status Toggle (Quick Action)

The system SHALL provide a quick-toggle switch on each agent card to activate or deactivate the agent without opening the full editor. Clicking the toggle SHALL first show a confirmation modal naming the target state; only on confirmation does the system call a mock API and optimistically update the UI. The quick-toggle SHALL only apply between `active` and `inactive`; it SHALL NOT be shown on `draft` agents, since transitioning out of `draft` is only done via the Playground's explicit "Go Live" action.

#### Scenario: Activating an inactive agent
- **WHEN** the user clicks the status switch on an inactive agent
- **THEN** a confirmation modal asks the user to confirm activating the agent

#### Scenario: Confirming activation
- **WHEN** the user confirms the activation modal
- **THEN** the switch moves to "Active", the status badge updates immediately (optimistic), and a mock PATCH request is fired; if the mock succeeds the state persists, if it fails the toggle reverts and shows a toast error

#### Scenario: Cancelling the toggle confirmation
- **WHEN** the user dismisses or cancels the confirmation modal
- **THEN** no API call is made and the agent's status is unchanged

#### Scenario: Draft agent has no quick toggle
- **WHEN** an agent card has `status: "draft"`
- **THEN** no active/inactive toggle switch is rendered; an "Open in Playground" action is shown in its place

### Requirement: Create Agent Entry Point

The system SHALL provide a prominent "Create Agent" button on the Dashboard that navigates the user to the Playground template picker.

#### Scenario: Clicking Create Agent
- **WHEN** the user clicks "Create Agent"
- **THEN** the router navigates to `/playground/new` and the template picker is shown

### Requirement: Open / Edit Agent

The system SHALL allow the user to open an existing agent for editing by clicking its card or a dedicated "Edit" action. Clicking an agent navigates to the Playground editor pre-populated with that agent's data.

#### Scenario: Opening an existing agent
- **WHEN** the user clicks an agent card
- **THEN** the router navigates to `/playground/:id` and the Playground editor loads with the agent's name, greeting, prompt, and behavior configuration pre-filled from mock data
