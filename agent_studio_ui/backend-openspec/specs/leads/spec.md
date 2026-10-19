# Leads Listing APIs

## Purpose

Listing leads from the two sources this server tracks. Both are now wired into the frontend — `src/app/core/services/lead.service.ts`'s `getPageLeads()`/`getAgentLeads()`, surfaced as the Page Leads / Agent Leads toggle in Monitor Detail's Leads tab (`src/app/features/monitor-agents/leads/`). Agent Leads defaults to loading on tab open; Page Leads only fetches once its toggle is clicked (its `agentId`-scoped Meta call is otherwise skipped).

- **Meta leads** (`GET /api/integrations/meta/leads`) — real, confirmed, wired. Facebook `leadgen` webhook submissions. Requires a mandatory `agentId` query param, scoping results to the leads for that agent's linked Page. Populated by `meta-adapter`'s webhook into the `meta_leads` collection.
- **Agent leads** (`GET /api/agents/:id/leads`) — real, wired. Leads attributed directly to one specific agent, independent of the Meta pipeline. Stored in a separate `agent_leads` collection, keyed by `agentId`. **Nothing writes to `agent_leads` yet** — expect an empty list for every agent until a future ingestion flow ships; the frontend treats that as a normal empty state, not an error. Its wire shape has no qualification/intent-summary/follow-up-action/outcome/call-linkage fields — `AgentLead.call`/`intent_summary`/`qualification`/`follow_up_action`/`outcome` are `null` for every real lead until a future backend change adds them; the Agent Leads card in `leads.component.html` conditionally hides each of those pieces when absent.

Both endpoints are read-only, share the exact same pagination/search/date-range query shape, and return the exact same envelope (`{ leads, total, page, limit }`) — only the shape of each lead object differs.

## Auth (both endpoints)

Standard app session (`Authorization: Bearer <jwt>`). Meta leads are scoped to the caller's company; agent leads are scoped to the caller's company **and** that specific agent (`404` if the agent belongs to a different company).

## Query params (both endpoints, identical)

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | `1` | 1-indexed |
| `limit` | number | `20` | Max `100` |
| `search` | string | – | Case-insensitive substring match against `fullName`/`phoneNumber` |
| `fromDate` | string | – | ISO date/datetime, inclusive lower bound |
| `toDate` | string | – | ISO date/datetime, inclusive upper bound |

Plain offset pagination (`skip`/`limit`), sorted newest-first. No `hasNextPage` field — compute it: `page < Math.ceil(total / limit)`. Filters aren't remembered between calls — repeat them on every page request. The frontend (`LeadsComponent`) currently only uses `page`/`limit`; `search`/`fromDate`/`toDate` aren't exposed in the UI yet.

---

## `GET /api/integrations/meta/leads`

Lists Meta leads (`leadgen` webhook) for the Page linked to a specific agent. Local read — no `meta-adapter` call.

**Query params**: same table as above, plus a mandatory `agentId` (string, the agent's Mongo `_id`) — the server resolves that agent's linked Page and scopes results to it. Missing `agentId` → `400`.

**Response** `200`
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
      "createdAt": "2026-09-10T08:15:02.000Z",
      "updatedAt": "2026-09-10T08:15:02.000Z",
      "callAttempts": [
        { "callId": "call_9c1e2b3d-4e5f-4a9b-8c0d-1e2f3a4b5c6d", "attemptedAt": "2026-09-10T09:00:00.000Z" },
        { "callId": "call_223344556677-8899-0011-2233-445566778899", "attemptedAt": "2026-09-11T14:30:00.000Z" }
      ]
    }
  ],
  "total": 37,
  "page": 1,
  "limit": 20
}
```
- **Scoped by mandatory `agentId`**, not `pageId` directly — the server resolves the agent's linked Page server-side and filters to it. The frontend (`LeadsComponent`) always passes the agent id from the Monitor Detail route. The frontend still resolves each lead's `pageId` to a Page name client-side via `MetaIntegrationService.pages()` (best-effort; falls back to the raw id if that Page isn't loaded/known) — the leads themselves are already agent-scoped by the API.
- `metaCreatedAt` = when Meta says the lead was submitted; `createdAt` = when the webhook row was inserted (usually a second or two later).
- `callAttempts` — one entry per time the agent linked to this lead's Page was triggered to call it (`callId` + `attemptedAt`). The frontend only surfaces the count (`callAttempts.length`), shown per lead as "Not called yet" / "Called N time(s)" — it doesn't currently link out to the individual calls. Treated as optional/defaulting to `0` client-side for leads predating this field.
- `total` ignores `page`/`limit`. Empty `leads` + `total: 0` is a valid, non-error state.

**Errors**: `400` (bad query params, e.g. `limit` > 100, or no company), `401`.

---

## `GET /api/agents/:id/leads`

`:id` is the agent's Mongo `_id` (same id as `GET /api/agents/:id`), not the separate `agent_id` business identifier.

**Response** `200`
```json
{
  "leads": [
    {
      "_id": "66d1a2b3c4d5e6f7a8b9c0d1",
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
- `leadCreatedAt` = when generated at the source (e.g. call end time); `createdAt` = when inserted into `agent_leads`.
- `source` reflects wherever it actually came from (`'call'`, `'manual'`, etc.) — not Meta-specific.
- **Will return an empty list for every agent right now** — nothing ingests into `agent_leads` yet. The frontend calls this unconditionally on Leads-tab open regardless, since an empty list is a valid response, not an error.

**Errors**: `400`, `401`, `404` (no such agent, or belongs to a different company).

---

## Data shapes (frontend-side)

```ts
// Wire shapes (lead-mapper.ts)
interface ApiCallAttempt { callId: string; attemptedAt: string; }
interface ApiMetaLead {
  id: string; customerId: string; pageId: string; leadgenId: string; formId: string;
  adId: string; adgroupId: string; fullName: string; phoneNumber: string; email: string;
  customFields: Record<string, string>; metaCreatedAt: string; createdAt: string; updatedAt: string;
  callAttempts?: ApiCallAttempt[];
}
// Unlike Meta leads, this endpoint returns the raw Mongo document — `_id`, not a normalized `id`.
interface ApiAgentLead {
  _id: string; customerId: string; agentId: string; leadId: string; source: string;
  fullName: string; phoneNumber: string; email: string; customFields: Record<string, string>;
  leadCreatedAt: string; createdAt: string; updatedAt: string;
}
interface ApiLeadsResponse<T> { leads: T[]; total: number; page: number; limit: number; }

// Frontend models (lead.model.ts)
interface PageLead {
  id: string; page_id: string; full_name: string; phone_number: string; email: string;
  custom_fields: Record<string, string>; submitted_at: string; call_attempts_count: number;
}
interface AgentLead {
  id: string; agent_id: string; customer_name: string | null; phone_number: string; email: string;
  custom_fields: Record<string, string>; source: string; created_at: string;
  // Not returned by the real API yet — always null until a future backend change adds them.
  call: CallRecord | null; intent_summary: string | null; qualification: LeadQualification | null;
  follow_up_action: string | null; outcome: LeadOutcome | null;
}
interface LeadsPage<T> { leads: T[]; total: number; page: number; limit: number; }
```

## Quick reference

| Method | Path | Query params | Scope | Frontend status |
|---|---|---|---|---|
| GET | `/api/integrations/meta/leads` | `agentId` (mandatory), `page`, `limit`, `search`, `fromDate`, `toDate` | Caller's company + that agent's linked Page | Wired — fetched on Page Leads toggle click |
| GET | `/api/agents/:id/leads` | `page`, `limit`, `search`, `fromDate`, `toDate` | Caller's company + this agent | Wired — fetched by default on Leads tab open; agent_leads collection is empty server-side |
