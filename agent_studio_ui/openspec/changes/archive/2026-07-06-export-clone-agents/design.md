## Context

The Playground editor (`src/app/features/playground/playground-editor/`) currently exposes name/greeting/prompt/behavior fields only, backed by `AgentService` (`createAgent`/`updateAgent`, mock `Observable`s with `delay(300)`). The `Agent` model already has a `tools: Tool[]` array from the original free-form builder, currently populated only via the generic Tools Management capability (agent-builder's Tools tab, with its own parameter-schema-builder UI). `requirements/Main_Flow.txt` frames a data-export destination explicitly as "a tool with tool description" (item 12), so the natural home for destinations is that same `tools` array — without dragging in the generic parameter-schema UI, which is overkill for four fixed destination shapes.

## Goals / Non-Goals

**Goals:**
- Let a Playground agent have zero or more export destinations (API webhook, SMS, WhatsApp, Email), stored as `Tool` entries in `Agent.tools`.
- Let any agent (draft, active, or inactive; Playground- or Builder-origin) be cloned into a new draft from the Dashboard or the Playground editor.
- Keep both features additive — no changes to the Draft/Live state machine, no changes to `tools-management`'s existing requirements.

**Non-Goals:**
- No real HTTP dispatch, SMS/WhatsApp/email sending — destinations are configuration only, simulated the same way every other mock API is.
- No reuse of the generic Tool Parameter Schema Builder UI — export destinations get their own small, purpose-built form per destination type.
- No cloning of version history (out of scope; the clone starts fresh).

## Decisions

- **`Tool` gains two optional fields**: `kind?: 'custom' | 'api_webhook' | 'sms' | 'whatsapp' | 'email'` (defaults to `'custom'` for every tool created via the existing Tools Management flow, so nothing there changes) and `destinationConfig?: { url?: string; recipient?: string }`. This avoids a second, parallel "destinations" array and keeps the agent JSON's existing `tools: [...]` contract intact — a destination is just a `Tool` whose `kind` isn't `'custom'`.
- **Export Destinations get their own component inside the Playground editor**, not a reuse of `tools-manager` (agent-builder's Tools tab component) — that component is wired to node-assignment concerns (which nodes reference a tool) that don't exist for Playground agents. The new UI is: pick a destination type, fill in the one or two fields that type needs (URL+description for `api_webhook`; recipient for `sms`/`whatsapp`/`email`), save. Each save produces/updates a `Tool` in `agent.tools`.
- **Clone is a single mock API call, not a client-side copy**: `AgentService.cloneAgent(id): Observable<Agent>` deep-clones the source agent server-side-equivalent (mock), assigns a new `id`, forces `status: 'draft'`, and computes the name via existing siblings — see naming rule below.
- **Clone naming rule**: strip any existing `" Clone <n>"` suffix from the source name to get a base name, then find the highest existing `<n>` among agents whose name matches `"<base> Clone <n>"`, and use `n + 1` (starting at 1 if none exist). This matches `requirements/Main_Flow.txt` item 18 ("agentname + clone + count") and avoids runaway names like "X Clone Clone Clone 1" when cloning a clone.
- **Clone is available regardless of agent origin or status**: Dashboard shows every agent (Builder- and Playground-origin) in one list per the `playground-mode` decision, and item 18 doesn't restrict cloning to live agents only ("either it's draft or live agent"), so inactive agents are cloneable too for consistency — there's no reason to special-case it out.

## Risks / Trade-offs

- [Overloading `Tool` with a `kind` discriminant could confuse the existing Tools Management UI if it doesn't filter by kind] → Mitigation: Tools Management's list/create/edit flows are untouched and only ever produce `kind: 'custom'`; the Playground's Export Destinations UI is the only place that reads/writes non-`'custom'` kinds, so the two surfaces don't collide in practice, but this is worth a quick check during implementation.
- [Clone naming collisions if two agents are cloned concurrently or names are edited to already match the pattern] → Acceptable for a mock/local-only system; a real backend would need a uniqueness constraint, out of scope here.
