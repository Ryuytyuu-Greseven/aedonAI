## Why

Every agent needs a dedicated mobile number to actually receive calls, but Playground currently has no concept of a phone number at all — agents are created and go live with no number attached. Numbers are also a scarce, country-specific resource (a US number can't serve a caller expecting a Thai number), so customers need a place to see what numbers they own, request new ones per country, and pick one when configuring an agent.

## What Changes

- Phone numbers become a **first-class, shared entity** (`PhoneNumber { id, e164, country_name, country_code, label, notes, status, assigned_agent_id, requested_at }`), independent of any single agent, managed via a new **"Phone Numbers" item in the main side navigation** — mirroring how Knowledge Base was made a shared, nav-level entity.
- New global **Phone Numbers list page**: a table of every number the user owns (number, country, status, assigned agent, requested date), with a **search box** (matches number/label/notes), a **country filter dropdown** (sourced from the existing `COUNTRY_CODES` constant), and **pagination**, following the exact filter/paginate/table pattern already used by the Call Log.
- New **"Request number" form** on that page: pick a country (dropdown from `COUNTRY_CODES`), enter the mobile number, and optional label/notes. Submitting creates the number in `available` status (mock — no real provisioning/carrier integration).
- **Playground Build tab gains a phone number picker** in the Basics card: selecting a Country lists that country's `available` numbers (plus the agent's currently-assigned number, if any) in a dropdown; selecting one assigns it to the agent (`Agent.phone_number_id`). Unassigning/reassigning frees the previous number back to `available`.
- **Agent model gains `phone_number_id?: string`**, a lightweight reference (mirrors how `knowledge_base_ids` references shared knowledge bases rather than embedding them).

## Capabilities

### New Capabilities
- `phone-number-library`: Global management of shared phone numbers — list, search/filter/paginate, request a new number per country, see assignment status. Lives behind a new main-nav "Phone Numbers" item.

### Modified Capabilities
- `playground`: The Basics card gains a country + phone number picker that assigns a shared phone number (from `phone-number-library`) to the agent being configured.
- `nav-shell`: Gains a fifth top-level navigation item, "Phone Numbers".

## Impact

- Affected frontend: new `src/app/core/models/phone-number.model.ts`, new `src/app/core/services/phone-number.service.ts` + `src/mocks/phone-numbers.mock.ts`, new `src/app/features/phone-numbers/phone-number-list/` (list + search + filter + pagination + request form), `nav-shell.component.ts` (new nav item + route), `agent.model.ts` (`phone_number_id?: string`), `playground-editor.component.ts`/`.html` (new country + number picker in the Basics card, using the existing `COUNTRY_CODES` constant from `src/app/shared/constants/countries.constant.ts`).
- No backend/API changes; number "requesting" and assignment remain mocked, consistent with the rest of the app.
- No breaking changes to existing data: `phone_number_id` is optional and defaults unset for existing agents.
