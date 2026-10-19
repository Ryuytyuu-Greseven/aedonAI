## ADDED Requirements

### Requirement: Phone Numbers List
The system SHALL provide a global "Phone Numbers" screen, reachable from the main navigation, listing every phone number owned by the account in a table with columns for the number, country, status (`available` or `assigned`), the assigned agent's name (if any), and the date it was requested.

#### Scenario: Viewing the list
- **WHEN** the user opens the Phone Numbers screen
- **THEN** all phone numbers are listed with their number, country, status, assigned agent (or none), and requested date

#### Scenario: Empty state
- **WHEN** the account has no phone numbers yet
- **THEN** the screen shows an empty state with a call to action to request a number

### Requirement: Search Phone Numbers
The system SHALL provide a search box on the Phone Numbers screen that filters the table to numbers whose phone number, label, or notes contain the search text (case-insensitive).

#### Scenario: Searching by number
- **WHEN** the user types part of a phone number into the search box
- **THEN** only rows whose number contains that text remain visible

#### Scenario: Searching by label
- **WHEN** the user types text matching a number's label or notes
- **THEN** rows with matching label or notes remain visible even if the number itself doesn't match

#### Scenario: Clearing the search
- **WHEN** the user clears the search box
- **THEN** the full (still country-filtered, if applicable) list is shown again

### Requirement: Filter Phone Numbers by Country
The system SHALL provide a country filter dropdown, populated from the existing country list, that restricts the table to numbers belonging to the selected country. The default selection SHALL show numbers from all countries.

#### Scenario: Filtering by a country
- **WHEN** the user selects a country from the filter dropdown
- **THEN** only numbers belonging to that country are shown in the table

#### Scenario: Combining search and country filter
- **WHEN** the user has both a country filter and search text applied
- **THEN** only numbers matching both conditions are shown

#### Scenario: Resetting the country filter
- **WHEN** the user selects "All countries" in the filter dropdown
- **THEN** numbers from every country are shown again, still subject to any active search text

### Requirement: Paginated Results
The system SHALL paginate the phone numbers table, showing a fixed page size per screen with Previous/Next controls and a summary of total results and current page, consistent with the pagination pattern used by the Call Log.

#### Scenario: More results than one page
- **WHEN** the filtered list contains more numbers than the page size
- **THEN** only the first page is shown initially, with pagination controls to view subsequent pages

#### Scenario: Changing a filter resets to page one
- **WHEN** the user changes the search text or country filter while viewing a page other than the first
- **THEN** the table returns to page one of the newly filtered results

#### Scenario: Navigating pages
- **WHEN** the user clicks "Next" on a page before the last
- **THEN** the next page of results is shown, and "Previous" becomes enabled

### Requirement: Request a New Phone Number
The system SHALL provide a form to request a new phone number, capturing a country (from the existing country list), the mobile number, and an optional label and notes. Submitting the form SHALL add the number to the list in `available` status.

#### Scenario: Successful request
- **WHEN** the user fills in country, mobile number, and label, and submits the request form
- **THEN** a new phone number is created with status `available` and appears in the list

#### Scenario: Missing required fields
- **WHEN** the user submits the request form without a country or without a mobile number
- **THEN** the form shows a validation error and no number is created

#### Scenario: Optional notes omitted
- **WHEN** the user submits the request form without notes
- **THEN** the number is still created successfully, with no notes recorded

### Requirement: Phone Number Assignment Status
The system SHALL reflect a phone number's current assignment on the Phone Numbers screen: `available` numbers show no assigned agent; numbers assigned to an agent (via the Playground phone number picker) show that agent's name and a distinct status indicator.

#### Scenario: Number assigned from Playground
- **WHEN** a phone number is assigned to an agent from the Playground editor
- **THEN** the Phone Numbers screen shows that number's status as `assigned` with the agent's name

#### Scenario: Number freed after reassignment
- **WHEN** an agent's assigned phone number is changed to a different number in Playground
- **THEN** the previously assigned number reverts to `available` status on the Phone Numbers screen
