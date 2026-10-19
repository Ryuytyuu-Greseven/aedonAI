# Sales Properties API

Covers property listings attached to a sales agent (e.g. for real-estate
style agents) — create, list, get one, update, and delete. A property
belongs to exactly one agent (`agentId`); an agent can have any number of
properties.

## Base URL & conventions

- Global prefix: all routes below are relative to `/api` (e.g. create is
  `POST /api/sales/properties`).
- All endpoints require `Authorization: Bearer <token>` (any authenticated
  role — no role restriction on these routes).
- Properties are scoped to the caller's company (`companyId` from the JWT),
  same as agents. Trying to access another company's property — or listing
  properties for another company's agent — returns `404`, not `403`.
- Request/response bodies are JSON.
- Validation is strict: unknown body fields are rejected (`400`), not
  silently dropped.
- Deletion is a **hard delete** — there is no disable/enable for properties;
  once deleted, a property is gone.
- Error shape (all non-2xx responses):
  ```json
  {
    "statusCode": 404,
    "path": "/api/sales/properties/66d0f1a2b3c4d5e6f7a8b9c0",
    "timestamp": "2026-09-17T10:00:00.000Z",
    "message": "Property 66d0f1a2b3c4d5e6f7a8b9c0 not found"
  }
  ```

## Property object

Returned by every endpoint below except delete:

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

Only two content fields: `name` and `description`. There are **no**
dedicated `price`/`sqft`/`address`/etc. fields — put all of that directly
into `description` as free text (see sample above). `description` is
optional and defaults to `null` if never set.

---

## `POST /api/sales/properties`

Create a property under an agent.

**Request**
```json
{
  "agentId": "66d0f1a2b3c4d5e6f7a8b9c0",
  "name": "3BHK Sea View Apartment",
  "description": "3-bedroom, 2-bath, 1850 sqft. $450,000. 12 Marine Drive, Springfield."
}
```

| field       | type   | rules                                       |
|-------------|--------|------------------------------------------------|
| agentId     | string | required, must be an agent in your company  |
| name        | string | required, min length 1                      |
| description | string | optional — put price/sqft/address/etc. here |

**Response** `201` — the created property object.

**Errors**
- `404` — no agent with that `agentId` (or it belongs to another company).
- `400` — `name`/`agentId` missing, or a field fails validation.

---

## `GET /api/sales/properties?agentId=:agentId`

List all properties for one agent. `agentId` is a **required** query
param — there is no "list all properties across all agents" mode.

**Request**
```
GET /api/sales/properties?agentId=66d0f1a2b3c4d5e6f7a8b9c0
```

**Response** `200` — array of property objects, newest first. Empty array
if the agent has no properties yet.

**Errors**
- `404` — no agent with that `agentId` (or it belongs to another company).
- `400` — `agentId` query param missing.

---

## `GET /api/sales/properties/:id`

Fetch a single property by id.

**Response** `200` — the property object.

**Errors**
- `404` — no property with that id (or it belongs to another company).

---

## `PATCH /api/sales/properties/:id`

Partial update — send only the fields you want to change. `agentId` and
`companyId` cannot be changed here (a property can't be moved to a
different agent/company through this endpoint).

**Request** (either field, both optional)
```json
{
  "description": "3-bedroom, 2-bath, 1850 sqft. $425,000 (price reduced). 12 Marine Drive, Springfield."
}
```

Same per-field validation rules as create, applied only to fields present
in the body.

**Response** `200` — the updated property object.

**Errors**
- `404` — no property with that id.
- `400` — a provided field fails validation.

---

## `DELETE /api/sales/properties/:id`

Permanently deletes the property. This is a hard delete — there's no
recovering it afterward.

**Response** `204` — no body.

**Errors**
- `404` — no property with that id.

---

## Quick reference

| Method | Path                                | Body                                  |
|--------|---------------------------------------|------------------------------------------|
| POST   | `/api/sales/properties`               | `agentId`, `name`, `description?`     |
| GET    | `/api/sales/properties?agentId=`      | –                                       |
| GET    | `/api/sales/properties/:id`           | –                                       |
| PATCH  | `/api/sales/properties/:id`           | any subset of `name`, `description`   |
| DELETE | `/api/sales/properties/:id`           | –                                       |
