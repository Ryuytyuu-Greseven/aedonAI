# Capability: Export Destinations

## Purpose

Export Destinations let a Playground agent send its collected call data somewhere useful once a call ends: an API webhook, or a notification to the agent owner via SMS, WhatsApp, or Email. Destinations are stored as specialized entries in the agent's existing `tools` array rather than a parallel data structure.

---

## Requirements

### Requirement: Add Export Destination
The system SHALL allow the user to add an export destination to a Playground agent of one of four types: API webhook, SMS, WhatsApp, or Email. An API webhook destination requires a URL and a description; an SMS, WhatsApp, or Email destination requires a recipient contact. Each saved destination SHALL be stored as an entry in the agent's `tools` array.

#### Scenario: Adding an API webhook destination
- **WHEN** the user selects "API webhook", enters a URL and description, and saves
- **THEN** a new entry is added to the agent's `tools` array representing that webhook, and it appears in the Export Destinations list

#### Scenario: Adding an SMS/WhatsApp/Email destination
- **WHEN** the user selects "SMS", "WhatsApp", or "Email", enters a recipient contact, and saves
- **THEN** a new entry is added to the agent's `tools` array representing that destination, and it appears in the Export Destinations list

#### Scenario: Missing required field
- **WHEN** the user attempts to save a destination without its required field(s) filled in
- **THEN** inline validation prevents save and indicates the missing field

### Requirement: Edit Export Destination
The system SHALL allow the user to edit an existing export destination's fields without changing its type.

#### Scenario: Editing a webhook URL
- **WHEN** the user updates the URL of an existing API webhook destination and saves
- **THEN** the corresponding `tools` entry is updated in place, preserving its id

### Requirement: Remove Export Destination
The system SHALL allow the user to remove an export destination from the agent.

#### Scenario: Removing a destination
- **WHEN** the user removes an export destination
- **THEN** the corresponding entry is removed from the agent's `tools` array and disappears from the Export Destinations list

### Requirement: Export Destinations List
The system SHALL display all export destinations currently configured on the agent, showing each one's type and its key identifying field (URL for webhook, recipient for SMS/WhatsApp/Email).

#### Scenario: Viewing configured destinations
- **WHEN** the agent has one or more export destinations configured
- **THEN** each is listed with its type and identifying field, distinct from any other tools on the agent
