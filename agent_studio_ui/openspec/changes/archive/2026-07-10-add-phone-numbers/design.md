## Context

Agents currently have no phone number of their own — `Agent` has `agent_name`, `agent_mode`, `greeting`, `prompt`, `behavior`, etc., but nothing that identifies which number a caller dials to reach it. Numbers are a finite, per-country resource shared across the whole account, not something that belongs to one agent, so the natural precedent is the `add-shared-knowledge-base` change: a first-class shared entity with its own nav item, list page, and a lightweight `*_id` reference from `Agent` — not an embedded array.

Countries are already enumerated in `src/app/shared/constants/countries.constant.ts` (`COUNTRY_CODES: CountryCode[]`, `{ name, flag, code }`). Some entries share a dial `code` (US/Canada both `+1`, UK/Scotland both `+44`), so a phone number's country must be tracked by `name` (unique in the list), not by `code`.

Everything in this app is mock-backed (`src/mocks/*.mock.ts` + services returning `of(...)`/`delay(...)` observables) — this change follows the same pattern, no real number provisioning/carrier/SMS integration.

## Goals / Non-Goals

**Goals:**
- A `PhoneNumber` shared entity with a global list screen: search, country filter, pagination, and a "Request number" form (country + number + label/notes).
- Let a Playground agent be assigned exactly one phone number, scoped by country, from the Basics card.
- Reuse existing global CSS (`.card`, `.input`/`.select`/`.label`/`.form-group`, `.btn*`, `.badge`, table conventions from `call-log.component.html`) — no new colors/tokens.

**Non-Goals:**
- No real telephony/carrier provisioning — "Request number" just creates a mock record.
- No number release/porting workflows, no per-minute billing, no SMS capability config.
- No multi-number-per-agent support (v1 is one number per agent, matching one dedicated line per agent).
- Not modifying `COUNTRY_CODES` itself.

## Decisions

- **New model file `phone-number.model.ts`** (not folded into `agent.model.ts`), mirroring `knowledge-base.model.ts`'s separation:
  ```ts
  export type PhoneNumberStatus = 'available' | 'assigned';

  export interface PhoneNumber {
    id: string;
    e164: string;            // full number incl. dial code, e.g. "+14155550100"
    country_name: string;    // matches CountryCode.name — the FK into COUNTRY_CODES
    label: string;           // short user-facing name, e.g. "US Support Line"
    notes?: string;
    status: PhoneNumberStatus;
    assigned_agent_id?: string;
    requested_at: string;
  }
  ```
  `status`/`assigned_agent_id` are kept in sync by the service when an agent picks/unpicks a number, rather than derived at read time, so the list page can show status without cross-referencing all agents. Alternative considered: derive status by scanning `Agent.phone_number_id` across all agents — rejected, it would require the phone-number list page to load every agent just to render a status column.

- **`Agent.phone_number_id?: string`** — optional, undefined for existing/new agents until a number is assigned, matching `knowledge_base_ids` reference style and `Agent.agent_mode?`'s optionality convention already established in this codebase.

- **`PhoneNumberService`** (mirrors `KnowledgeBaseService`): `getPhoneNumbers()`, `getPhoneNumber(id)`, `getAvailableForCountry(countryName, currentAgentPhoneNumberId?)`, `requestPhoneNumber(input)`, `assignToAgent(phoneNumberId, agentId)`, `unassignFromAgent(phoneNumberId)`. Assignment/unassignment mutate the mock store's `status`/`assigned_agent_id` so the list page reflects it immediately. `getAvailableForCountry` includes the agent's own currently-assigned number even though its status is `assigned`, so re-opening the picker still shows the current selection as a choosable option.

- **Playground integration**: the picker lives in the Basics card, after the existing Agent mode radio group and before Agent name (grouped with other agent-identity fields). It is two controls: a Country `<select>` (options from `COUNTRY_CODES`, deduped by `name`) and a Phone number `<select>` populated from `getAvailableForCountry` for the chosen country. Changing country resets the number selection unless the previously-assigned number belongs to the newly chosen country. Assignment is committed on Save (same lifecycle as every other Basics field — see `buildPayload`/`persist` in `playground-editor.component.ts`), not immediately on dropdown change, so Cancel still discards it.

- **List page pattern**: `PhoneNumberListComponent` copies `CallLogComponent`'s signal shape — `search`/`countryFilter`/`page` signals, `filtered`/`pagedNumbers`/`totalPages` computed, `PAGE_SIZE` constant, Previous/Next buttons, "N numbers · Page X of Y" footer — for consistency with the one other paginated table in the app.

- **Nav & routes**: new nav item `{ path: '/phone-numbers', label: 'Phone Numbers', icon: 'fa-solid fa-phone' }` in `nav-shell.component.ts`, new lazy route `phone-numbers` → `PhoneNumberListComponent` (single page, no separate detail route needed — the request form is inline/modal on the list page, matching how MCP servers are managed inline rather than via a detail route).

## Risks / Trade-offs

- [Two Playground tabs racing to assign the same number] → Out of scope for a mock, single-user demo app (same assumption already made for knowledge bases/MCP servers); no locking added.
- [Country dedup by `name` vs `code`] → `COUNTRY_CODES` has duplicate `code`s (US/Canada, UK/Scotland); using `name` as the country key avoids ambiguity when listing "numbers in this country" or filtering.
- [Status drift if an agent is deleted while holding a number] → No agent-delete flow exists in this app today, so not handled; if added later, deletion should call `unassignFromAgent` for symmetry with the assign path.

## Migration Plan

No existing data to migrate — `phone_number_id` is a new optional field and `MOCK_AGENTS` entries simply omit it (`undefined`) except where seeded with a demo assignment. New `src/mocks/phone-numbers.mock.ts` seeds a handful of numbers across a few countries, at least one pre-assigned to an existing mock agent for demo purposes.

## Open Questions

- None blocking; number format validation (e.g., strict E.164 regex per country) is left loose for v1 — a non-empty string is accepted, consistent with how other mock forms in this app (MCP server URL, referral bonus amount) do minimal validation.
