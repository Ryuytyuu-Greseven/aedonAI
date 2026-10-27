# Meta OAuth Exchange API

Called by another service (e.g. the frontend, or a backend acting on a logged-in
user's behalf) right after the user completes the Facebook Login popup. Exchanges
the short-lived authorization `code` for permanent Page access tokens, subscribes
every Page the user manages to `leadgen` webhook events, and links each Page to
the caller's company (`customerId`) for later lead ingestion.

## Endpoint

```
POST {BASE_URL}/meta/oauth/exchange
```

`BASE_URL` is wherever meta-adapter is deployed (e.g. `http://localhost:2005` locally).

## Auth

Requires a valid JWT issued by `lyreai_agent_builder_server`, sent as a Bearer token:

```
Authorization: Bearer <jwt>
```

The token must resolve to a user with a non-null `companyId` — meta-adapter reads
this live from the shared `users` / `revoked_tokens` collections (same DB as
`agent_builder_server`), so a disabled account or a revoked/logged-out token is
rejected here too, not just on the issuing service.

`customerId` for every connected Page is always derived from this token's
`companyId` — it is never accepted from the request body.

## Request

```
Content-Type: application/json
```

```json
{
  "code": "AQD_short_lived_facebook_oauth_code_from_login_popup"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | string | yes | The `code` Facebook's Login dialog returns to your frontend's redirect/callback. Single-use, expires within minutes — call this endpoint immediately. |

### Sample cURL

```bash
curl --location 'http://localhost:2005/meta/oauth/exchange' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
--data '{
  "code": "AQD_short_lived_facebook_oauth_code_from_login_popup"
}'
```

## Response

### 200 OK — success

```json
{
  "success": true,
  "pages": [
    { "id": "109871234567890", "name": "Clasen Builders Main Page" },
    { "id": "223344556677889", "name": "Clasen Builders Ads Page" }
  ]
}
```

- `pages` lists **every** Facebook Page the authenticated user manages that Meta
  returned via `/me/accounts` — not a single page. If the user administers 5
  Pages, all 5 are connected and subscribed in one call. See the "single page vs
  all pages" note below if the caller needs to scope this down.
- Each entry is auto-subscribed to `leadgen` webhook events and upserted into
  the `connectedpages` collection under the caller's `companyId`, so leads
  submitted on any of these Pages will start flowing into `POST /meta/webhook`
  immediately.

### 400 Bad Request

Returned for any Graph API failure (invalid/expired `code`, bad app credentials,
Meta-side error at any exchange step) or if the authenticated user has no
`companyId`:

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

### 401 Unauthorized

Missing/invalid/expired JWT, a revoked session, or a disabled account:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## Notes for the calling server

- **Idempotent per Page**: re-calling this endpoint (e.g. user re-authorizes) upserts
  on `pageId`, so it refreshes tokens rather than creating duplicates.
- **Not transactional across Pages**: if the user manages 5 Pages and Meta errors
  out on the 3rd page's subscribe call, the first 2 are already persisted and stay
  connected — a retry is safe (idempotent) but partial failures are possible.
- **No response body field is a "you must call this again" signal** — a `200`
  means every Page listed in `pages` is fully connected and subscribed.
