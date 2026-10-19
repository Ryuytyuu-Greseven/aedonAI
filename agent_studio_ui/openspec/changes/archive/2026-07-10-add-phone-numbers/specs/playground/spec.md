## ADDED Requirements

### Requirement: Phone Number Assignment
The system SHALL allow the user to assign a dedicated phone number to the agent being configured, from the Basics card of the Build tab. The user SHALL first select a country, then select from that country's `available` phone numbers (per the `phone-number-library` capability), including the agent's currently-assigned number if it belongs to that country.

#### Scenario: Selecting a country lists its available numbers
- **WHEN** the user selects a country in the phone number picker
- **THEN** the number dropdown lists that country's available phone numbers (plus the agent's own currently-assigned number, if it belongs to that country)

#### Scenario: Assigning a number and saving
- **WHEN** the user selects a phone number and saves the agent
- **THEN** the agent is persisted with that phone number assigned, and the number's status becomes `assigned` to this agent

#### Scenario: Changing country clears an incompatible selection
- **WHEN** the user changes the country after already selecting a number from a different country
- **THEN** the number selection is cleared and the dropdown repopulates with the new country's available numbers

#### Scenario: Reassigning frees the previous number
- **WHEN** the user changes the assigned number to a different one and saves
- **THEN** the previously assigned number reverts to `available` status and the newly selected number becomes `assigned` to this agent

#### Scenario: No number assigned
- **WHEN** the user saves an agent without selecting a phone number
- **THEN** the agent is saved with no phone number assigned, unaffected by this requirement

#### Scenario: Cancelling discards the pending assignment
- **WHEN** the user changes the phone number selection and then clicks "Cancel" instead of saving
- **THEN** no phone number assignment change is persisted
