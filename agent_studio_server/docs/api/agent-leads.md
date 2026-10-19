# Leads Listing APIs

Covers listing leads from both sources this server tracks:

- **Meta leads** (`GET /api/integrations/meta/leads`) — Facebook `leadgen`
  webhook submissions, filtered down to the Page(s) linked to one specific
  agent. Populated by `meta-adapter`'s webhook into the `meta_leads`
  collection; this server resolves the agent's linked Pages from the
  `connectedpages` collection to filter them.
- **Agent leads** (`GET /api/agents/:id/leads`) — leads attributed directly
  to one specific agent, independent of the Meta pipeline (e.g. gathered via
  live calls once an agent has been linked and tested). Stored in a separate
  `agent_leads` collection, keyed by `agentId` instead of `pageId`.

Both endpoints are agent-scoped, read-only from this server's side, share
the exact same pagination/search/date-range query shape, and return the
exact same top-level response envelope (`{ leads, total, page, limit }`) —
only the shape of each lead object differs, since they come from different
sources.

> **Nothing writes to `agent_leads` yet.** The schema and this listing API
> exist so the frontend can build against a stable shape now; a future
> ingestion flow will insert rows into it (mirroring how `meta_leads` is
> populated by meta-adapter's webhook today). Until then, expect an empty
> list for every agent.

## Auth (both endpoints)

```
Authorization: Bearer <jwt>
```

Standard app session. Both endpoints are scoped to the caller's company
**and** a specific agent — the agent must belong to the caller's company,
or you get `404`.

## Query params (both endpoints share these)

| Param      | Type   | Default | Notes                                                        |
|------------|--------|---------|----------------------------------------------------------------|
| `page`     | number | `1`     | 1-indexed                                                    |
| `limit`    | number | `20`    | Max `100`                                                    |
| `search`   | string | –       | Case-insensitive substring match against `fullName` or `phoneNumber` |
| `fromDate` | string | –       | ISO date/datetime, inclusive lower bound on when the lead came in |
| `toDate`   | string | –       | ISO date/datetime, inclusive upper bound                     |

For **agent leads**, the agent is identified by the `:id` path segment. For
**Meta leads**, there is no path segment — the agent is instead a
**required** `agentId` query param (see below).

Pagination is plain offset (`skip`/`limit`), sorted newest-first. The
response has no `hasNextPage`/`nextCursor` field — compute it from `total`:

```js
const totalPages = Math.ceil(total / limit);
const hasNextPage = page < totalPages;
```

Filters aren't remembered between calls — repeat `search`/`fromDate`/
`toDate` on every page request.

---

## `GET /api/integrations/meta/leads`

Lists the caller's Meta leads (from the `leadgen` webhook meta-adapter
subscribes Pages to) for one agent. Resolves which Page(s) that agent is
linked to (`agentId` on `connectedpages`, set via
[`assign-agent`](./integrations-meta.md)) and filters `meta_leads` down to
just those Pages — an agent linked to more than one Page gets leads from
all of them combined. No call out to `meta-adapter` happens here.

### Request

| Param     | Type   | Required | Notes                                                    |
|-----------|--------|----------|-------------------------------------------------------------|
| `agentId` | string | **yes**  | Only leads from Page(s) linked to this agent are returned. Must belong to your company. |

Plus the shared `page`/`limit`/`search`/`fromDate`/`toDate` params above.

### Sample cURL

```bash
curl --location 'http://localhost:2000/api/integrations/meta/leads?agentId=66d0f1a2b3c4d5e6f7a8b9c0&page=1&limit=20&search=john&fromDate=2026-09-01&toDate=2026-09-16' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

### Response

#### `200 OK`

```json
{
  "leads": [
    {
      "id": "66d1a2b3c4d5e6f7a8b9c0d1",
      "customerId": "acme-corp_3f2a9c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b",
      "pageId": "109871234567890",
      "leadgenId": "778899001122",
      "formId": "665544332211",
      "adId": "334455667788",
      "adgroupId": "223344556677",
      "fullName": "John Doe",
      "phoneNumber": "+14155552671",
      "email": "john@example.com",
      "customFields": { "budget": "50000-100000" },
      "metaCreatedAt": "2026-09-10T08:15:00.000Z",
      "callAttempts": [
        { "callId": "call_9c1e2b3d-4e5f-4a9b-8c0d-1e2f3a4b5c6d", "attemptedAt": "2026-09-10T09:00:00.000Z" },
        { "callId": "call_223344556677-8899-0011-2233-445566778899", "attemptedAt": "2026-09-11T14:30:00.000Z" }
      ],
      "createdAt": "2026-09-10T08:15:02.000Z",
      "updatedAt": "2026-09-10T08:15:02.000Z"
    }
  ],
  "total": 37,
  "page": 1,
  "limit": 20
}
```

- `metaCreatedAt` is when Meta says the lead was submitted; `createdAt` is
  when meta-adapter's webhook inserted the row — usually a second or two
  later, occasionally more under load.
- `callAttempts` lists every call an agent has made against this lead, each
  with the `callId` (the call log's identifier) and `attemptedAt` (when that
  call was made). An empty array means no agent has called this lead yet.
  Use `callAttempts.length` for a "3 call attempts" style badge. **Nothing
  in this server writes to `callAttempts` yet** — this endpoint only reads
  and returns whatever's there, so don't assume a particular order until
  whatever populates it (elsewhere) is confirmed; sort client-side by
  `attemptedAt` if display order matters.
- `total` is the full match count (ignoring `page`/`limit`).
- An empty `leads` array with `total: 0` means either no leads match the
  filters, or the agent exists but has no Page linked to it yet — both are
  valid states, not errors.

#### `400 Bad Request`

Missing/invalid `agentId`, invalid other query params (e.g. `limit` over
100, malformed `fromDate`), or the caller has no company:

```json
{
  "statusCode": 400,
  "message": ["agentId should not be empty"],
  "error": "Bad Request"
}
```

#### `401 Unauthorized`

```json
{ "statusCode": 401, "message": "Unauthorized" }
```

#### `404 Not Found`

No agent with that `agentId`, or it belongs to a different company:

```json
{
  "statusCode": 404,
  "message": "Agent 66d0f1a2b3c4d5e6f7a8b9c0 not found",
  "error": "Not Found"
}
```

---

## `GET /api/agents/:id/leads`

Lists leads attributed directly to one agent. `:id` is the agent's id — the
same id used everywhere else in the Agents API (`GET /api/agents/:id`,
`POST /api/agents/:id/disable`, etc.), i.e. its Mongo `_id`, **not** the
separate `agent_id` business identifier used by the
`by-agent-id/:agentId/history` route.

### Sample cURL

```bash
curl --location 'http://localhost:2000/api/agents/66d0f1a2b3c4d5e6f7a8b9c0/leads?page=1&limit=20' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

### Response

#### `200 OK`

```json
{
  "leads": [
    {
      "id": "66d1a2b3c4d5e6f7a8b9c0d1",
      "customerId": "acme-corp_3f2a9c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b",
      "agentId": "66d0f1a2b3c4d5e6f7a8b9c0",
      "leadId": "call-9c1e2b3d-4e5f-4a9b-8c0d-1e2f3a4b5c6d",
      "source": "call",
      "fullName": "Jane Smith",
      "phoneNumber": "+14155559999",
      "email": "jane@example.com",
      "customFields": { "interest": "pricing" },
      "leadCreatedAt": "2026-09-15T14:30:00.000Z",
      "createdAt": "2026-09-15T14:30:01.000Z",
      "updatedAt": "2026-09-15T14:30:01.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

- `leadCreatedAt` is when the lead was generated at its source (e.g. call
  end time); `createdAt` is when the row was inserted into `agent_leads`.
- `source` reflects wherever the lead actually came from (e.g. `'call'`,
  `'manual'`) — not necessarily `'meta'`, since this collection isn't
  Meta-specific.
- `total` is the full match count (ignoring `page`/`limit`).

#### `400 Bad Request`

Invalid query params, or the caller has no company:

```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 100"],
  "error": "Bad Request"
}
```

#### `401 Unauthorized`

```json
{ "statusCode": 401, "message": "Unauthorized" }
```

#### `404 Not Found`

No agent with that id, or it belongs to a different company:

```json
{
  "statusCode": 404,
  "message": "Agent 66d0f1a2b3c4d5e6f7a8b9c0 not found",
  "error": "Not Found"
}
```

---

## Quick reference

| Method | Path                              | Query params                                                  | Scope                          |
|--------|-------------------------------------|------------------------------------------------------------------|------------------------------------|
| GET    | `/api/integrations/meta/leads`      | **`agentId` (required)**, `page`, `limit`, `search`, `fromDate`, `toDate` | Caller's company + this agent's linked Page(s) |
| GET    | `/api/agents/:id/leads`             | `page`, `limit`, `search`, `fromDate`, `toDate`                   | Caller's company + this agent      |
