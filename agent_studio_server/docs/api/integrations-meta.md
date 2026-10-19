# Meta Integration API

Covers connecting Facebook Pages via Meta OAuth, listing the Pages currently
connected for the caller's company, disabling/enabling them, and linking
each Page to the agent that should handle its leads/live calls.

> For listing leads (both Meta leads and per-agent leads), see
> [Leads Listing APIs](./agent-leads.md) — pulled out into its own doc since
> the two lead-listing endpoints share one query/response shape and are best
> implemented together on the frontend.

- `POST /connect` is a thin proxy: it validates the caller's session, then
  forwards the request to the `meta-adapter` microservice, which owns the
  actual Graph API exchange, `leadgen` webhook subscription, and
  Page-to-company linking.
- Every other endpoint below (`GET /pages`, the disable/enable routes, and
  the agent-linking routes) is handled entirely by this server, reading/
  writing directly against the shared `connectedpages` MongoDB collection
  that `meta-adapter` writes into — no extra call to `meta-adapter` is made
  for these.
- **Per-page/bulk `enable`/`disable` are soft.** Disabling a single Page or
  bulk-re-enabling (`enable-all`) only flips `isActive` — the row, its
  agent link, and its access token all stay intact, matching how knowledge
  base files/urls and phone numbers are disabled/enabled elsewhere in this
  API.
- **`disable-all` is different: it's a full, permanent disconnect.** It
  deletes every connected Page row for the company outright — there is no
  re-enable afterward. See its section below before wiring a "Disconnect"
  button to it.
- All routes are relative to `/api/integrations/meta` and require the normal
  app session (`Authorization: Bearer <jwt>`), scoped to the caller's
  company — a company only ever sees/manages its own connected Pages.

---

## `POST /api/integrations/meta/connect`

Exchange the short-lived OAuth `code` for connected Facebook Pages.

### Auth

Requires the normal app session — send the same JWT you use for every other
`/api` call:

```
Authorization: Bearer <jwt>
```

This token is forwarded as-is to `meta-adapter`, which re-validates it itself
(against the shared users/revoked-tokens data) and derives the company to
link Pages to from it. There is no separate `companyId`/`customerId` field in
the request — it's never accepted from the frontend.

### Request

```
Content-Type: application/json
```

```json
{
  "code": "AQD_short_lived_facebook_oauth_code_from_login_popup"
}
```

| Field  | Type   | Required | Notes                                                                                   |
|--------|--------|----------|------------------------------------------------------------------------------------------|
| `code` | string | yes      | The `code` Facebook's Login dialog returns to your redirect/callback. Single-use, expires within minutes — call this endpoint immediately after receiving it. |

#### Sample request (fetch)

```js
const response = await fetch('/api/integrations/meta/connect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  },
  body: JSON.stringify({ code: facebookAuthCode }),
});
const data = await response.json();
```

#### Sample cURL

```bash
curl --location 'http://localhost:2000/api/integrations/meta/connect' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
--data '{
  "code": "AQD_short_lived_facebook_oauth_code_from_login_popup"
}'
```

### Response

#### `200 OK` — success

```json
{
  "success": true,
  "pages": [
    { "id": "109871234567890", "name": "Clasen Builders Main Page" },
    { "id": "223344556677889", "name": "Clasen Builders Ads Page" }
  ]
}
```

- `pages` lists **every** Facebook Page the authenticated user manages — not
  a single page. If the user administers 5 Pages, all 5 are connected and
  subscribed to `leadgen` webhooks in this one call.
- A `200` means every Page listed is fully connected and subscribed — there's
  no "call this again" follow-up signal in the body.
- Re-calling this endpoint (e.g. the user re-authorizes) is safe: it upserts
  per Page, refreshing tokens rather than creating duplicates.
- **Not transactional across Pages**: if the user manages 5 Pages and Meta
  errors out partway through, the Pages already processed stay connected. A
  retry is safe, but partial results are possible — don't assume all-or-
  nothing.

#### `400 Bad Request`

Relayed as-is from `meta-adapter` — invalid/expired `code`, bad app
credentials, any Graph API failure, or the authenticated user has no
associated company:

```json
{
  "statusCode": 400,
  "message": "Invalid verification code format.",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "User is not associated with a company",
  "error": "Bad Request"
}
```

#### `401 Unauthorized`

Missing/invalid/expired JWT, a revoked session, or a disabled account —
returned by our own auth guard **or** by `meta-adapter`'s own re-validation
of the forwarded token:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### `502 Bad Gateway`

Only for genuine proxy failures — `meta-adapter` is unreachable, or it
returned a `5xx` of its own:

```json
{
  "statusCode": 502,
  "message": "Failed to reach the meta adapter server"
}
```
```json
{
  "statusCode": 502,
  "message": "Meta adapter failed to process the connect request",
  "status": 503,
  "details": { "...": "meta-adapter's raw error body" }
}
```

### Frontend integration notes

- Trigger the Facebook Login popup, grab the `code` it returns to your
  redirect handler, and call this endpoint immediately — don't cache or
  delay, the code expires within minutes.
- On `200`, show the returned `pages` to the user (e.g. "Connected: Clasen
  Builders Main Page, Clasen Builders Ads Page") — there's nothing further
  to do to finish connecting them.
- On `400`, surface `message` directly — it's already a user-facing reason
  (bad/expired code, or the account has no company to link to).
- On `401`, treat it like any other expired-session response: send the user
  back through your normal login flow.
- On `502`, treat it as a transient infrastructure failure — safe to let the
  user retry (the operation is idempotent per Page on the backend).
- **After a page refresh**, don't rely on having the `pages` array from the
  `connect` response in memory — call `GET /pages` (below) to re-fetch the
  currently connected list.

---

## `GET /api/integrations/meta/pages`

Lists **every** Page connected for the caller's company, active or disabled
— since disconnecting no longer deletes rows, this is the one place to see
full state (including which agent, if any, is linked to each Page). Reads
straight from our own database — no call out to `meta-adapter` happens here,
so this is safe to call on every page load/refresh to restore the UI state.

### Request

No body. `Authorization: Bearer <jwt>` only.

```bash
curl --location 'http://localhost:2000/api/integrations/meta/pages' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

### Response

#### `200 OK`

```json
{
  "pages": [
    {
      "pageId": "109871234567890",
      "pageName": "Clasen Builders Main Page",
      "isActive": true,
      "agentId": "66d0f1a2b3c4d5e6f7a8b9c0",
      "connectedAt": "2026-09-16T10:00:00.000Z"
    },
    {
      "pageId": "223344556677889",
      "pageName": "Clasen Builders Ads Page",
      "isActive": false,
      "agentId": null,
      "connectedAt": "2026-09-16T10:00:00.000Z"
    }
  ]
}
```

- `isActive: false` means the Page was disabled (see below) — it's still
  connected/known, just excluded from live use. It never disappears from
  this list.
- `agentId` is `null` until a Page is linked via `assign-agent` below.
- `accessToken` is never included in this or any other response from this
  API.

#### `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "User is not associated with a company",
  "error": "Bad Request"
}
```

#### `401 Unauthorized`

```json
{ "statusCode": 401, "message": "Unauthorized" }
```

---

## `POST /api/integrations/meta/pages/:pageId/disable`

Soft-disconnects a single Page: sets `isActive: false`. The row, its
`agentId` link, and its access token are all kept as-is — nothing is
deleted, so re-enabling needs no new OAuth flow.

### Request

No body.

```bash
curl --location --request POST \
  'http://localhost:2000/api/integrations/meta/pages/109871234567890/disable' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

### Response

#### `200 OK`

```json
{
  "page": {
    "pageId": "109871234567890",
    "pageName": "Clasen Builders Main Page",
    "isActive": false,
    "agentId": "66d0f1a2b3c4d5e6f7a8b9c0",
    "connectedAt": "2026-09-16T10:00:00.000Z"
  }
}
```

#### `404 Not Found`

No Page with that id exists for the caller's company (never connected, or
belongs to a different company):

```json
{
  "statusCode": 404,
  "message": "Connected page 109871234567890 not found for this company",
  "error": "Not Found"
}
```

#### `400 Bad Request` / `401 Unauthorized`

Same shape as the other endpoints above.

---

## `POST /api/integrations/meta/pages/:pageId/enable`

Reverses `disable` — sets `isActive: true` on that Page. Same request/
response/error shape as disable above, just the opposite flag value.

---

## `POST /api/integrations/meta/pages/disable-all`

**Full disconnect — permanently deletes every Page** connected under the
caller's company in one call. This is the "Disconnect Facebook" action.

Unlike every other endpoint on this page, this is a **hard delete**: the
row, its agent link, and its access token are all gone. There is no
re-enable/undo — reconnecting requires going through `POST /connect` again,
which re-creates fresh rows (new tokens, no memory of previous agent
links).

### Request

No body.

```bash
curl --location --request POST \
  'http://localhost:2000/api/integrations/meta/pages/disable-all' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

### Response

#### `200 OK`

```json
{ "success": true, "deletedCount": 2 }
```

- Idempotent: calling this with nothing currently connected returns
  `deletedCount: 0`, not an error.

#### `400 Bad Request` / `401 Unauthorized`

Same shape as the other endpoints above.

---

## `POST /api/integrations/meta/pages/enable-all`

Bulk-reverses individual `disable` calls: sets `isActive: true` on every
still-existing Page for the company. This does **not** undo `disable-all`
— once a Page has been deleted via `disable-all`, there is nothing left
here to re-enable; reconnecting means going through `POST /connect` again.
Same request/response/error shape as `disable-all`, but with `isActive`
flipped rather than rows deleted.

---

## `PATCH /api/integrations/meta/pages/:pageId/assign-agent`

Links a Page to the agent that should handle its `leadgen` leads / be
tested via live calls on that Page. This is independent of `isActive` —
you can link an agent to a currently-disabled Page, and disabling a Page
never clears its agent link.

### Request

```json
{ "agentId": "66d0f1a2b3c4d5e6f7a8b9c0" }
```

| Field     | Type   | Required | Notes                                                                 |
|-----------|--------|----------|-------------------------------------------------------------------------|
| `agentId` | string | yes      | The agent's id (same id used in `/api/agents/:id`). Must belong to the caller's company. |

```bash
curl --location --request PATCH \
  'http://localhost:2000/api/integrations/meta/pages/109871234567890/assign-agent' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  --data '{ "agentId": "66d0f1a2b3c4d5e6f7a8b9c0" }'
```

### Response

#### `200 OK`

```json
{
  "page": {
    "pageId": "109871234567890",
    "pageName": "Clasen Builders Main Page",
    "isActive": true,
    "agentId": "66d0f1a2b3c4d5e6f7a8b9c0",
    "connectedAt": "2026-09-16T10:00:00.000Z"
  }
}
```

- Re-calling with a different `agentId` re-links the Page to the new agent
  (replaces, doesn't stack) — a Page has at most one linked agent at a time.
  An agent can be linked to more than one Page.

#### `404 Not Found`

Either the Page or the agent wasn't found for the caller's company:

```json
{
  "statusCode": 404,
  "message": "Agent 66d0f1a2b3c4d5e6f7a8b9c0 not found",
  "error": "Not Found"
}
```
```json
{
  "statusCode": 404,
  "message": "Connected page 109871234567890 not found for this company",
  "error": "Not Found"
}
```

#### `400 Bad Request` / `401 Unauthorized`

Same shape as the other endpoints above.

---

## `POST /api/integrations/meta/pages/:pageId/unassign-agent`

Clears a Page's agent link without touching `isActive`.

### Request

No body.

```bash
curl --location --request POST \
  'http://localhost:2000/api/integrations/meta/pages/109871234567890/unassign-agent' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

### Response

#### `200 OK`

```json
{
  "page": {
    "pageId": "109871234567890",
    "pageName": "Clasen Builders Main Page",
    "isActive": true,
    "agentId": null,
    "connectedAt": "2026-09-16T10:00:00.000Z"
  }
}
```

#### `404 Not Found` / `400 Bad Request` / `401 Unauthorized`

Same shape as `assign-agent` above (page-not-found case only — there's no
agent to validate here).

---

## Quick reference

| Method | Path                                                | Body       | Notes                                       |
|--------|-------------------------------------------------------|------------|------------------------------------------------|
| POST   | `/api/integrations/meta/connect`                       | `code`     | Proxies to meta-adapter                     |
| GET    | `/api/integrations/meta/pages`                         | –          | Local read, company-scoped, all statuses    |
| POST   | `/api/integrations/meta/pages/:pageId/disable`         | –          | Soft-disconnect one Page                    |
| POST   | `/api/integrations/meta/pages/:pageId/enable`          | –          | Reverses disable                            |
| POST   | `/api/integrations/meta/pages/disable-all`             | –          | **Hard delete** — full disconnect, no undo  |
| POST   | `/api/integrations/meta/pages/enable-all`              | –          | Reverses disable-all                        |
| PATCH  | `/api/integrations/meta/pages/:pageId/assign-agent`    | `agentId`  | Link a Page to an agent                     |
| POST   | `/api/integrations/meta/pages/:pageId/unassign-agent`  | –          | Clear a Page's agent link                   |

For `GET /api/integrations/meta/leads`, see [Leads Listing APIs](./agent-leads.md).
