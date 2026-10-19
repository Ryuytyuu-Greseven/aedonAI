## ADDED Requirements

### Requirement: Referral Bonus Section Visibility
The system SHALL show a Referral Bonus section in the Playground editor only when the agent's template is flagged `referral_bonus_eligible` in the static agent catalog (currently Real Estate Sales only). Non-eligible agents SHALL NOT show this section, and SHALL NOT carry a `referral_bonus` value.

#### Scenario: Eligible template shows the section
- **WHEN** the user is editing an agent based on the Real Estate Sales template
- **THEN** the Referral Bonus section is visible in the editor

#### Scenario: Non-eligible template hides the section
- **WHEN** the user is editing an agent based on any template other than Real Estate Sales
- **THEN** the Referral Bonus section is not shown, and the saved agent has no `referral_bonus` value

### Requirement: Referral Bonus Amount and Currency
The system SHALL allow the user to set a referral bonus amount and select its currency from a fixed list: USD, INR, AED, THB, GBP, EUR.

#### Scenario: Setting a referral bonus
- **WHEN** the user enters a bonus amount and selects a currency, then saves
- **THEN** the agent's `referral_bonus` is persisted with that amount and currency

#### Scenario: Changing currency
- **WHEN** the user changes the currency selector
- **THEN** the previously entered amount is preserved, only the currency changes
