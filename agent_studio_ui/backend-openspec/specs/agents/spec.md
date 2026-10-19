# Agents API

## Purpose

CRUD, cloning, status transitions, and the preview-call action for the `Agent` resource. Backs `src/app/core/services/agent.service.ts` in full. This is the largest and most-used surface — it's behind the Dashboard, the Playground editor, Monitor Agents (reads only), and Reporting (reads `Agent` indirectly via call records).

**Important context on `nodes`/`tools`:** `Agent` has `nodes: AgentNode[]` and `tools: Tool[]` fields inherited from an earlier free-form "Agent Builder" graph-editing mode. That mode is dormant (still routable at `/agents/new` and `/agents/:id` in the frontend, unlinked from navigation) but not deleted — a future product tier may revive it. **Keep both fields in the data model and API responses even though the active Playground flow never populates `nodes`** (Playground-created agents always have `nodes: []`). Do not drop `nodes` from the schema just because it's unused today.

**Important context on `tools`:** as of the `export-destinations` capability, `tools` entries with `kind !== 'custom'` are not real LLM tools — they're export destinations (API webhook / SMS / WhatsApp / Email). See the `Tool` shape below.

---

## Data shapes

```ts
type AgentStatus = 'active' | 'inactive' | 'draft';
type ToolKind = 'custom' | 'api_webhook' | 'sms' | 'whatsapp' | 'email';
type Currency = 'USD' | 'INR' | 'AED' | 'THB' | 'GBP' | 'EUR';

interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];       // always [] for non-'custom' kind (export destinations)
  returns?: string;
  kind?: ToolKind;                   // absent/'custom' = real tool from the dormant Agent Builder mode
  destinationConfig?: { url?: string; recipient?: string }; // only present when kind !== 'custom'
}

interface ReferralBonus {
  amount: number;
  currency: Currency;
}

interface Agent {
  id: string;
  agent_name: string;
  enable_voice: boolean;
  status: AgentStatus;
  nodes: AgentNode[];                // see note above — keep in schema, empty for Playground agents
  tools: Tool[];
  created_at: string;                // ISO 8601
  updated_at: string;                // ISO 8601
  base_template_id?: string;         // set for every agent created via Playground; absent for dormant-mode agents
  greeting?: string;
  prompt?: string;
  behavior?: string;
  referral_bonus?: ReferralBonus;    // only present when base template is referral_bonus_eligible
}
```

---

## GET /api/agents

Backs `AgentService.getAgents(): Observable<Agent[]>`. Powers the Dashboard's full list and Monitor Agents' active-only filter (frontend filters client-side today; fine to keep doing that, or add `?status=active` server-side filtering as an optimization — not required).

**Auth required:** Yes.
**Response 200:** `Agent[]`

## GET /api/agents/:id

Backs `AgentService.getAgent(id): Observable<Agent>`.

**Response 200:** `Agent`
**Response 404:** agent not found — frontend already has an error handler that redirects to `/dashboard` with a toast on this.

## POST /api/agents

Backs `AgentService.createAgent(draft?: Partial<Agent>): Observable<Agent>`. Called by the Playground editor's Save/Preview actions the first time an agent is persisted.

**Request body:** `Partial<Agent>` — in practice always includes `agent_name`, `greeting`, `prompt`, `behavior`, `tools`, `status: 'draft'`, `enable_voice: true`, `base_template_id`, and `referral_bonus` when applicable.

**Response 201:** the created `Agent`, with server-assigned `id`, `created_at`, `updated_at`.

#### Scenario: Creating a new agent from a template
- **WHEN** the Playground editor saves a template customization for the first time
- **THEN** a new agent is created with `status: "draft"`

## PATCH /api/agents/:id

Backs `AgentService.updateAgent(id, data: Partial<Agent>): Observable<Agent>`. This is the single most overloaded endpoint in the mock — it's used for: saving edits, toggling active/inactive (Dashboard quick-toggle), and Go Live (`{ status: 'active' }`). Consider whether you want to keep it this generic or split status transitions into a dedicated endpoint (see below) — the mock's genericity is a mock convenience, not a design requirement.

**Request body:** any subset of `Agent` fields to merge in.
**Response 200:** the updated `Agent`, with `updated_at` refreshed server-side.
**Response 404:** agent not found.

#### Scenario: Editing a live agent
- **WHEN** an `active` agent is edited and saved
- **THEN** the changes persist and `status` remains `active` — editing must never silently revert status

## DELETE /api/agents/:id

Backs `AgentService.deleteAgent(id): Observable<void>`.

**Response 204.**
**Response 404:** agent not found.

## POST /api/agents/:id/clone

Backs `AgentService.cloneAgent(id): Observable<Agent>`. Available from the Dashboard and the Playground editor for any agent regardless of status.

**Response 201:** the newly created clone (`Agent`), always `status: "draft"`, new `id`, `created_at`/`updated_at` set to now, all other fields (`greeting`, `prompt`, `behavior`, `enable_voice`, `tools`, `base_template_id`, `referral_bonus`) copied from the source.

### Business rule: clone naming (currently client-computed — move server-side)

Name the clone `<base name> Clone <n>`:
1. Strip any existing ` Clone <n>` suffix from the source's `agent_name` to get `<base name>`.
2. Find the highest `<n>` among **all** agents whose name matches `^<base name> Clone (\d+)$`.
3. New clone's name is `<base name> Clone <max + 1>` (starts at 1 if none exist).

This must happen **server-side**, atomically, under a lock/transaction — the mock does this as an in-memory synchronous scan, which is safe there but a real implementation with concurrent requests needs to guard against a race where two clones of the same agent, requested at nearly the same time, both compute `Clone 1` and collide. A unique constraint on `(source_base_name, clone_number)` or an equivalent serialized read-modify-write is the fix.

#### Scenario: Cloning a clone
- **WHEN** "Weekend Survey Line Clone 2" is cloned
- **THEN** the result is named "Weekend Survey Line Clone 3", never "Weekend Survey Line Clone 2 Clone 1" (i.e., always strip existing suffix before appending a new one)

## POST /api/agents/:id/preview

Backs `AgentService.previewCall(id): Observable<{ transcript: string }>`. **Only called on an agent that was just saved/updated in the same request sequence** — the frontend's `preview()` flow is: persist current form state (POST or PATCH as above) → call this endpoint with the resulting id.

**Response 200:**
```json
{ "transcript": "string" }
```

The mock generates a canned transcript referencing the agent's `greeting`/`prompt`. A real implementation could genuinely invoke an LLM with the agent's config and a synthetic caller turn, or keep it templated — either satisfies the frontend contract, which only needs a `transcript` string to display.

### Business rule: "Go Live" requires a preview in the same session — this needs a real design, not a mirror

The frontend currently tracks "has this agent been successfully previewed since the last edit" as **ephemeral component state**, reset on any form change and never persisted. A real backend cannot replicate "same browser session" this way, and shouldn't try to — instead:

- **Recommended:** add `preview_hash: string | null` to the `Agent` record, set by this endpoint to a hash of the agent's current customization fields (`greeting` + `prompt` + `behavior` + `tools` serialized). The Go Live endpoint (below) checks that the agent's *current* fields still hash to `preview_hash`; if they don't match (i.e., anything changed since the last preview), reject Go Live with 409 and a message telling the frontend to preview again.
- This is a genuine product/design decision, not something to reverse-engineer from the mock — the mock's client-side-only approach was an explicit, documented simplification (`openspec/changes/archive/2026-07-06-preview-and-referral/design.md` if you want the original reasoning), not a spec to copy literally.

## PATCH /api/agents/:id/status

**Not a separate endpoint in the mock today** (folded into the generic PATCH above) — called out here because it's worth considering splitting out, since it's the one mutation with real business rules attached:

- `draft` → `active` ("Go Live"): only allowed if the preview-hash check above passes. Confirmed via a modal on the frontend (UI-only concern, not a backend rule).
- `active` ↔ `inactive` (Dashboard quick-toggle): freely allowed either direction. Confirmed via a modal on the frontend.
- `draft` agents **cannot** be toggled to `active`/`inactive` via this path — the mock explicitly throws `Draft agents must go live from the Playground` if attempted. Enforce this server-side too: a draft can only become `active` via the Go Live path (with its preview-hash check), never via a bare status PATCH.

#### Scenario: Attempting to toggle a draft agent
- **WHEN** a status update targets a `draft` agent with `active`/`inactive`
- **THEN** reject with 409 — draft agents transition to `active` only through the Go Live path

---

## Business rules the backend must enforce (summary)

- Clone naming + collision safety (see above) — move the whole computation server-side.
- Fallback-to-template-default on blank fields: **currently entirely client-side** in `PlaygroundEditorComponent` (if the user clears a field and saves, the frontend substitutes the template default before sending the PATCH/POST — the backend never sees a blank value today). If you want this enforced server-side too (defense in depth against a client that doesn't run this logic, e.g. a future mobile app or API-direct integration), you need the template's defaults available server-side too (see `templates/spec.md`) and to re-run the same substitution: empty `agent_name`/`greeting`/`prompt` → the referenced template's corresponding default.
- `referral_bonus` must only be persisted when the agent's `base_template_id` resolves to a template with `referral_bonus_eligible: true` — reject (or silently drop) a `referral_bonus` on a non-eligible agent rather than trusting the client not to send one.
- Draft-only Go Live gate (see preview-hash above).

## Open decisions

- Splitting `PATCH /api/agents/:id/status` out from the generic PATCH — the mock's genericity is convenient for a mock, not necessarily a good real API shape.
- The preview-hash / Go Live gating mechanism — needs an actual decision, not a mirror (see above).
- Whether `nodes`/`tools`-based free-form agents (the dormant Agent Builder mode) get a real backend at all, or whether that mode stays permanently frontend-only/unused. Nothing in the current requirements resolves this either way.
