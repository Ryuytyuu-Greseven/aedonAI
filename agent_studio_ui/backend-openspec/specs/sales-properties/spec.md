# Sales Properties API

## Purpose

Property listings attached to a sales agent (e.g. Real Estate Sales template agents) — create, list, get one, update, and delete. A property belongs to exactly one agent (`agentId`); an agent can have any number. Backs `src/app/core/services/property.service.ts`, surfaced as the "Properties" section in the Playground editor sidebar (`src/app/features/playground/agent-properties/`) — shown only for agents whose template id is `real_estate_sales`.

**This is real, confirmed, and wired.**

## Base URL & conventions

- Global prefix: relative to `/api` (create is `POST /api/sales/properties`).
- All endpoints require `Authorization: Bearer <token>` — any authenticated role, no role restriction.
- Scoped to the caller's company (`companyId` from the JWT), same as agents. Accessing another company's property, or listing properties for another company's agent, returns `404`, not `403`.
- Validation is strict: unknown body fields are rejected (`400`), not silently dropped.
- **Deletion is a hard delete.** No disable/enable — once deleted, gone for good. The frontend gates this behind a confirm dialog with explicit "cannot be undone" copy.
- Error shape (all non-2xx):
  ```json
  { "statusCode": 404, "path": "/api/sales/properties/66d0f1a2b3c4d5e6f7a8b9c0", "timestamp": "2026-09-17T10:00:00.000Z", "message": "Property 66d0f1a2b3c4d5e6f7a8b9c0 not found" }
  ```

## Property object

```json
{
  "id": "66d1a2b3c4d5e6f7a8b9c0d1",
  "companyId": "acme-corp_3f2a9c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b",
  "agentId": "66d0f1a2b3c4d5e6f7a8b9c0",
  "name": "3BHK Sea View Apartment",
  "description": "3-bedroom, 2-bath, 1850 sqft. $450,000. 12 Marine Drive, Springfield. Sea-facing, covered parking, spacious balcony.",
  "created_at": "2026-09-17T10:00:00.000Z",
  "updated_at": "2026-09-17T10:00:00.000Z"
}
```

Only two content fields: `name` and `description`. **No dedicated `price`/`sqft`/`address`/`customFields` fields** — all of that goes directly into `description` as free text. `description` is optional, defaults to `null`.

---

## `POST /api/sales/properties`

**Request**
```json
{ "agentId": "66d0f1a2b3c4d5e6f7a8b9c0", "name": "3BHK Sea View Apartment", "description": "..." }
```
| field | type | rules |
|---|---|---|
| agentId | string | required, must be an agent in your company |
| name | string | required, min length 1 |
| description | string | optional |

**Response** `201` — the created property.

**Errors**: `404` (no such agent for this company), `400` (missing/invalid fields).

---

## `GET /api/sales/properties?agentId=:agentId`

`agentId` is a **required** query param — no "all agents" mode. Frontend calls this on Properties section load/agent-id-change.

**Response** `200` — array, newest first. Empty array if the agent has none yet (not an error).

**Errors**: `404` (no such agent), `400` (missing `agentId`).

---

## `GET /api/sales/properties/:id`

**Response** `200` — the property. **Errors**: `404`.

---

## `PATCH /api/sales/properties/:id`

Partial update — only fields present in the body are changed. `agentId`/`companyId` cannot be changed here.

**Request** (either field, both optional): `{ "description": "..." }`

**Response** `200` — the updated property. **Errors**: `404`, `400`.

---

## `DELETE /api/sales/properties/:id`

**Response** `204` — no body. **Errors**: `404`.

---

## Data shapes (frontend-side)

```ts
// Wire (property-mapper.ts)
interface ApiProperty { id: string; companyId: string; agentId: string; name: string; description: string | null; created_at: string; updated_at: string; }

// Frontend model (property.model.ts)
interface Property { id: string; agent_id: string; name: string; description: string | null; created_at: string; updated_at: string; }
interface CreatePropertyInput { name: string; description?: string; }
interface UpdatePropertyInput { name?: string; description?: string; }
```

## Quick reference

| Method | Path | Body |
|---|---|---|
| POST | `/api/sales/properties` | `agentId`, `name`, `description?` |
| GET | `/api/sales/properties?agentId=` | – |
| GET | `/api/sales/properties/:id` | – |
| PATCH | `/api/sales/properties/:id` | any subset of `name`, `description` |
| DELETE | `/api/sales/properties/:id` | – |
