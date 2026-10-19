## ADDED Requirements

### Requirement: Sales Agents Screen Route
The system SHALL present a Sales Agents screen at `/admin`, reachable only by an authenticated session with `role: 'admin'`, listing existing agent accounts and providing a way to add a new one. Every other route in the app remains reachable by both `admin` and `agent` sessions identically (see `user-auth` capability's Route Protection requirement).

#### Scenario: Admin visits /admin
- **WHEN** a user with an active session and `role: 'admin'` navigates to `/admin`
- **THEN** the system renders the Sales Agents screen

#### Scenario: Agent attempts to visit /admin
- **WHEN** a user with an active session and `role: 'agent'` navigates to `/admin`
- **THEN** the system redirects them to `/monitor` and does not render the Sales Agents screen

### Requirement: Create Sales Agent Login
The system SHALL let an admin create a new agent account by providing a name, email, and password, via a modal on the Sales Agents screen — not a separate page/route. The new account becomes usable to log in at the shared `/login` screen with `role: 'agent'`.

#### Scenario: Admin creates an agent account
- **WHEN** an admin opens the "Add Sales Agent Login" modal from the Sales Agents screen and submits a name, a valid email, and a password
- **THEN** the system creates the account, closes the modal, shows a success confirmation, and the new credentials can subsequently authenticate at `/login` with `role: 'agent'`

#### Scenario: Duplicate email
- **WHEN** an admin submits an email that already belongs to an existing account
- **THEN** the system shows an inline error in the modal and does not create a duplicate account

#### Scenario: Invalid form submission
- **WHEN** an admin submits the modal with a missing name, a missing/invalid email, or an empty password
- **THEN** the system shows a validation error and does not attempt account creation

### Requirement: List Sales Agent Accounts
The system SHALL show the admin a list of all agent accounts, including each account's name, email, and whether it is currently enabled or disabled.

#### Scenario: Viewing the list
- **WHEN** an admin navigates to the "Sales Agents" list screen
- **THEN** the system displays every agent account's name, email, and enabled/disabled status

#### Scenario: Empty state
- **WHEN** no agent accounts exist yet
- **THEN** the system shows an empty state prompting the admin to add one

### Requirement: Disable/Enable Sales Agent Login
The system SHALL let an admin disable an agent account to block that account from logging in, and re-enable it later.

#### Scenario: Disabling an account
- **WHEN** an admin disables an agent account from the list screen
- **THEN** the system marks the account disabled and a subsequent login attempt with those credentials is rejected

#### Scenario: Re-enabling an account
- **WHEN** an admin re-enables a previously disabled agent account
- **THEN** the system marks the account enabled and that account can log in again

### Requirement: Update Sales Agent Name
The system SHALL let an admin update the name on an existing agent account independently of any other field, via a dedicated action from the list screen.

#### Scenario: Admin updates an agent's name
- **WHEN** an admin opens the "Update Name" action for an account and submits a non-empty name
- **THEN** the system saves the new name, reflects it immediately in the list, and shows a success confirmation

#### Scenario: Empty name rejected
- **WHEN** an admin submits an empty name
- **THEN** the system shows a validation error and does not update the account

### Requirement: Reset Sales Agent Password
The system SHALL let an admin reset the password on an existing agent account independently of any other field, via a dedicated action from the list screen. The account's email and enabled/disabled status are unaffected.

#### Scenario: Admin resets an agent's password
- **WHEN** an admin opens the "Reset Password" action for an account and submits a new password (at least 8 characters) with a matching confirmation
- **THEN** the system updates the account's password, and the account can subsequently log in only with the new password — the old password is rejected

#### Scenario: Password too short or confirmation mismatch
- **WHEN** an admin submits a password under 8 characters, or a confirmation that doesn't match
- **THEN** the system shows a validation error and does not reset the password

### Requirement: Per-Row Actions Use Icon Buttons With Tooltips
The system SHALL present "Update Name," "Reset Password," and "Enable/Disable" as icon-only buttons in each account row's Actions cell, each with a native tooltip (and matching accessible label) identifying the action and, for Enable/Disable, its current effect.

#### Scenario: Hovering an action icon
- **WHEN** an admin hovers the "Update Name" or "Reset Password" icon in a row
- **THEN** the browser shows a native tooltip with the action's label (e.g., "Update name", "Reset password")

#### Scenario: Enable/Disable tooltip reflects current state
- **WHEN** an admin hovers the enable/disable icon for an enabled account
- **THEN** the tooltip reads "Disable account"; for a disabled account it reads "Enable account"
