## MODIFIED Requirements

### Requirement: Agent List

The system SHALL display a list of all agents belonging to the current user, showing each agent's name, status (Draft / Staged / Live / Disabled), the template it is based on, creation date, last modified date, and whether voice is enabled. The list SHALL be populated from an API call on page load.

#### Scenario: Page load with agents
- **WHEN** the Dashboard page loads
- **THEN** an API call is made, the response is mapped to the agent list, and agents are rendered as cards/rows within 200 ms of the response

#### Scenario: Empty state
- **WHEN** the API returns an empty array
- **THEN** an empty-state illustration and a "Create your first agent" call-to-action button are displayed

#### Scenario: Loading state
- **WHEN** the API call is in flight
- **THEN** skeleton placeholder cards are shown in place of agent entries

#### Scenario: Draft agent shown in list
- **WHEN** the agent list includes an agent with status `draft`
- **THEN** it is rendered with a "Draft" badge and its originating template name

#### Scenario: Staged agent shown in list
- **WHEN** the agent list includes an agent with status `staged`
- **THEN** it is rendered with a "Staged" badge and its originating template name

---

### Requirement: Active / Inactive Filter

The system SHALL provide a segmented control or tab group that filters the agent list by status: All, Live, Disabled, Staged, Draft. The filter SHALL update the list instantly without a new API call.

#### Scenario: Filter to Live
- **WHEN** the user selects the "Live" filter
- **THEN** only agents with `status: "live"` are shown; the count badge on the tab updates accordingly

#### Scenario: Filter to Disabled
- **WHEN** the user selects the "Disabled" filter
- **THEN** only agents with `status: "disabled"` are shown

#### Scenario: Filter to Staged
- **WHEN** the user selects the "Staged" filter
- **THEN** only agents with `status: "staged"` are shown; the count badge on the tab updates accordingly

#### Scenario: Filter to Draft
- **WHEN** the user selects the "Draft" filter
- **THEN** only agents with `status: "draft"` are shown; the count badge on the tab updates accordingly

---

### Requirement: Agent Status Toggle (Quick Action)

The system SHALL provide a quick-toggle switch on each agent card to disable or re-enable the agent without opening the full editor. Clicking the toggle SHALL first show a confirmation modal naming the target state; only on confirmation does the system call the disable/enable API and optimistically update the UI. The quick-toggle SHALL only apply between `live` and `disabled`; it SHALL NOT be shown on `draft` or `staged` agents, since transitioning out of `draft`/`staged` is only done via the Playground's explicit "Move to Staging" and "Go Live" actions.

#### Scenario: Disabling a live agent
- **WHEN** the user clicks the status switch on a `live` agent
- **THEN** a confirmation modal asks the user to confirm disabling the agent

#### Scenario: Confirming disable
- **WHEN** the user confirms the disable modal
- **THEN** the switch moves to "Disabled", the status badge updates immediately (optimistic), and a call to the disable API is fired; if it succeeds the state persists, if it fails the toggle reverts and shows a toast error

#### Scenario: Re-enabling a disabled agent
- **WHEN** the user clicks the status switch on a `disabled` agent and confirms
- **THEN** the switch moves to "Live", the status badge updates immediately (optimistic), and a call to the enable API is fired; if it succeeds the state persists, if it fails the toggle reverts and shows a toast error

#### Scenario: Cancelling the toggle confirmation
- **WHEN** the user dismisses or cancels the confirmation modal
- **THEN** no API call is made and the agent's status is unchanged

#### Scenario: Draft or staged agent has no quick toggle
- **WHEN** an agent card has `status: "draft"` or `status: "staged"`
- **THEN** no live/disabled toggle switch is rendered; an "Open in Playground" action is shown in its place
