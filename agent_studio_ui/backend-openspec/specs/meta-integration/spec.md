# Meta Integration API

## Purpose

Connecting Facebook Pages via Meta OAuth, listing the Pages currently connected for the caller's company, disabling/enabling them, and linking each Page to the agent that should handle its leads/live calls. Backs `src/app/core/services/meta-integration.service.ts` and `src/app/core/http/api.service.ts`, surfaced at `/admin-settings` in the frontend (Meta Integration section).

**All endpoints below are real and confirmed.**

## Architecture

- `POST /connect` is a thin proxy: it validates the caller's session, then forwards the request to the `meta-adapter` microservice, which owns the actual Graph API exchange, `leadgen` webhook subscription, and Page-to-company linking.
- Every other endpoint (`GET /pages`, the disable/enable routes, and the agent-linking routes) is handled entirely by this server, reading/writing directly against the shared `connectedpages` MongoDB collection that `meta-adapter` writes into — no extra call to `meta-adapter`.
- **Per-Page disable/enable (`:pageId/disable`, `:pageId/enable`) is a soft toggle** — flips `isActive` only, row/agent-link/token stay intact, re-enabling needs no new OAuth flow. Same pattern as knowledge base files/urls and phone numbers elsewhere in this API.
- **`disable-all` ("Disconnect Meta") is confirmed to actually delete every connected Page's record for the company**, despite its name — not a soft flag flip like the single-Page/`isActive` endpoints. The frontend (`MetaIntegrationService.disconnectAll()`) treats a successful call as clearing all Pages client-side and reverting to "Connect to Meta", not as marking rows disabled.
- All routes are relative to `/api/integrations/meta` and require the normal app session (`Authorization: Bearer <jwt>`), scoped to the caller's company — a company only ever sees/manages its own connected Pages. No `companyId` field is ever accepted from the frontend; it's always derived from the JWT.

## Flow

1. Frontend redirects to Meta's OAuth dialog with its own `client_id`/`redirect_uri` — backend not involved.
2. Meta redirects back to the frontend's callback route with `?code&state`.
3. Frontend calls `POST /connect` with just the `code`.
4. Frontend calls `GET /pages` on every load to restore state — not just after `connect`, since it's the only endpoint that reports each Page's `isActive`/`agentId`.
5. Enabling/disabling a Page or all Pages, and assigning/unassigning an agent, are independent toggles — none of them affect the others.

---

## `POST /api/integrations/meta/connect`

**Request** `{ "code": "..." }` — single-use, expires within minutes.

**Response** `200`
```json
{ "success": true, "pages": [{ "id": "109871234567890", "name": "Clasen Builders Main Page" }] }
```
- Lists **every** Page the user manages, connects and subscribes all of them in one call. No `enabled`/`agentId` here — a `200` means everything listed is freshly connected and unassigned.
- Idempotent per Page (upserts, refreshing tokens). **Not transactional across Pages** — partial failure leaves already-processed Pages connected.

**Errors**: `400` (bad/expired code, no company), `401` (auth), `502` (proxy failure, safe to retry).

---

## `GET /api/integrations/meta/pages`

Lists **every** Page connected for the caller's company, active or disabled — the only place to see full state (including agent link). Local read, safe on every load.

**Response** `200`
```json
{
  "pages": [
    { "pageId": "109871234567890", "pageName": "Clasen Builders Main Page", "isActive": true, "agentId": "66d0f1a2b3c4d5e6f7a8b9c0", "connectedAt": "2026-09-16T10:00:00.000Z" },
    { "pageId": "223344556677889", "pageName": "Clasen Builders Ads Page", "isActive": false, "agentId": null, "connectedAt": "2026-09-16T10:00:00.000Z" }
  ]
}
```
- `isActive: false` = disabled but still connected/known — never disappears from this list.
- `agentId` is `null` until linked via `assign-agent`.
- `accessToken` never included in any response.

**Errors**: `400`/`401`.

---

## `POST /api/integrations/meta/pages/:pageId/disable` / `.../enable`

Soft-disconnects/reconnects a single Page — flips `isActive` only; row, agent link, and token untouched.

**Response** `200`: `{ "page": { "pageId": "...", "pageName": "...", "isActive": false, "agentId": "...", "connectedAt": "..." } }`

**Errors**: `404` (no such Page for this company), `400`/`401`.

---

## `POST /api/integrations/meta/pages/disable-all` / `.../enable-all`

`disable-all` backs the "Disconnect Meta" button — for every Page under the company in one call. **Unlike the single-Page `disable` endpoint above, this one is confirmed to actually delete the records**, not just flip `isActive`. `enable-all` reverses `isActive` the same way single-Page `enable` does (untested whether it can restore Pages `disable-all` already deleted).

**Response** `200`: `{ "success": true, "updatedCount": 2 }` — idempotent, `updatedCount: 0` if nothing to flip.

**Errors**: `400`/`401`.

---

## `PATCH /api/integrations/meta/pages/:pageId/assign-agent`

Links a Page to the agent that should handle its `leadgen` leads / live calls. Independent of `isActive` — you can link an agent to a disabled Page.

**Request**: `{ "agentId": "66d0f1a2b3c4d5e6f7a8b9c0" }` — must belong to the caller's company.

**Response** `200`: `{ "page": { ...same shape as above, "agentId": "66d0f1a2b3c4d5e6f7a8b9c0" } }`
- Re-calling with a different `agentId` re-links (replaces, doesn't stack) — **a Page has at most one linked agent, but an agent can be linked to more than one Page.** This is looser than the frontend's earlier assumption of strict 1:1 in both directions — the UI no longer excludes an agent from other Pages' options.

**Errors**: `404` (Page or agent not found for this company), `400`/`401`.

---

## `POST /api/integrations/meta/pages/:pageId/unassign-agent`

Clears a Page's agent link without touching `isActive`. No body.

**Response** `200`: `{ "page": { ..., "agentId": null } }`

**Errors**: `404` (Page not found), `400`/`401`.

---

## Data shapes (frontend-side)

```ts
// Wire shapes (meta-integration-mapper.ts)
interface ApiMetaPage { id: string; name: string; }
interface ApiMetaConnectResponse { success: boolean; pages: ApiMetaPage[]; }

interface ApiConnectedPage { pageId: string; pageName: string; isActive: boolean; agentId: string | null; connectedAt: string; }
interface ApiGetPagesResponse { pages: ApiConnectedPage[]; }
interface ApiConnectedPageResponse { page: ApiConnectedPage; }

// Frontend model (meta-integration.model.ts) — both fields are now real, backend-persisted
interface MetaPage { id: string; name: string; enabled: boolean; linkedAgentId: string | null; }
```

## Quick reference

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/integrations/meta/connect` | `code` | Proxies to `meta-adapter` |
| GET | `/api/integrations/meta/pages` | – | Local read, company-scoped, all statuses |
| POST | `/api/integrations/meta/pages/:pageId/disable` | – | Soft-disconnect one Page |
| POST | `/api/integrations/meta/pages/:pageId/enable` | – | Reverses disable |
| POST | `/api/integrations/meta/pages/disable-all` | – | "Disconnect Meta" — **actually deletes** all of the company's Pages |
| POST | `/api/integrations/meta/pages/enable-all` | – | Reverses disable-all |
| PATCH | `/api/integrations/meta/pages/:pageId/assign-agent` | `agentId` | Link a Page to an agent (not exclusive) |
| POST | `/api/integrations/meta/pages/:pageId/unassign-agent` | – | Clear a Page's agent link |
