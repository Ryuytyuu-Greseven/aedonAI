## 1. Data model & mocks

- [x] 1.1 Create `src/app/core/models/phone-number.model.ts` with `PhoneNumberStatus`, `PhoneNumber`, and helper functions (e.g. `phoneNumberMatchesSearch`, `phoneNumberDisplayLabel`) following the style of `knowledge-base.model.ts`
- [x] 1.2 Add `phone_number_id?: string` to `Agent` in `src/app/core/models/agent.model.ts`
- [x] 1.3 Create `src/mocks/phone-numbers.mock.ts` (`MOCK_PHONE_NUMBERS: PhoneNumber[]`) seeding numbers across several countries from `COUNTRY_CODES`, with at least one pre-assigned to an existing `MOCK_AGENTS` entry (set that agent's `phone_number_id` to match)

## 2. Phone number service

- [x] 2.1 Create `src/app/core/services/phone-number.service.ts` with `getPhoneNumbers()`, `getPhoneNumber(id)`, `getAvailableForCountry(countryName, currentAgentPhoneNumberId?)`, `requestPhoneNumber(input)`, `assignToAgent(phoneNumberId, agentId)`, `unassignFromAgent(phoneNumberId)`, mock-backed per `KnowledgeBaseService`'s conventions (in-memory array + `of(...)`/`delay(...)`)
- [x] 2.2 Wire `PlaygroundEditorComponent`'s save flow to call `assignToAgent`/`unassignFromAgent` when the agent's `phone_number_id` changes on save

## 3. Phone Numbers list screen

- [x] 3.1 Create `src/app/features/phone-numbers/phone-number-list/phone-number-list.component.{ts,html,css}`: signals for `search`, `countryFilter`, `page`; computed `filtered`/`pagedNumbers`/`totalPages`; `PAGE_SIZE` constant — mirroring `call-log.component.ts`
- [x] 3.2 Build the table (number, country, status, assigned agent, requested date) using `.table`/table-scroll conventions from `call-log.component.html`, with loading skeleton and empty states
- [x] 3.3 Add the search input (`.input`) filtering by number/label/notes
- [x] 3.4 Add the country filter `<select>` (`.select`) populated from `COUNTRY_CODES` deduped by `name`, with an "All countries" option
- [x] 3.5 Add Previous/Next pagination controls and "N numbers · Page X of Y" footer
- [x] 3.6 Add the "Request number" form (country select, mobile number input, label input, notes textarea) as an inline panel or modal on the list screen, using `.card`/`.form-group`/`.btn` conventions; wire to `requestPhoneNumber`
- [x] 3.7 Verify all styling uses only existing global classes/CSS variables from `src/styles/globals.css` (no new hardcoded colors) and looks correct in both light and dark themes

## 4. Navigation & routing

- [x] 4.1 Add `{ path: '/phone-numbers', label: 'Phone Numbers', icon: 'fa-solid fa-phone' }` to `navItems` in `nav-shell.component.ts`
- [x] 4.2 Add a lazy `phone-numbers` route in `app.routes.ts` loading `PhoneNumberListComponent`

## 5. Playground integration

- [x] 5.1 Add a Country `<select>` (from `COUNTRY_CODES`, deduped by `name`) and a Phone number `<select>` to the Basics card in `playground-editor.component.html`, placed after the Agent mode radio group and before Agent name
- [x] 5.2 Add `agent_country`/`phone_number_id` form controls to `PlaygroundEditorComponent`'s reactive form; populate the number dropdown via `getAvailableForCountry` whenever the selected country changes
- [x] 5.3 On country change, clear the number selection unless the currently-assigned number belongs to the newly selected country
- [x] 5.4 Load the agent's existing assignment on edit (derive selected country from the assigned number's `country_name`, if any) in `loadExistingAgent`/`syncFormFromAgent`/`onRestoreVersion`
- [x] 5.5 Include `phone_number_id` in `buildPayload`; ensure Cancel discards any in-progress selection (no service call until Save)

## 6. Verification

- [x] 6.1 `ng build` succeeds with no new TypeScript errors
- [x] 6.2 Manually drive the app (per the `run` skill / verify skill): request a number, assign it to an agent from Playground, confirm it shows `assigned` with the right agent on the Phone Numbers screen, reassign to a different number and confirm the old one reverts to `available`
- [x] 6.3 Verify search, country filter, and pagination interact correctly (filter resets page to 1, combined filters narrow correctly)
- [x] 6.4 Verify dark/light theme rendering on the new screen
