## Why

`requirements/Main_Flow.txt` redefines how general customers build agents: instead of the existing free-form node graph, they pick one of five fixed in-house agent templates (Real Estate Sales, Survey, Contact Centre, Alerting, General) and customize prompt, greeting, and behavior only — no node/flow editing. This is a template-driven "Playground" experience, distinct enough from the existing Agent Builder that it needs its own capabilities. The existing free-form graph builder remains valuable for a future fully-custom agent tier, so it stays in the codebase but is removed from active navigation rather than deleted.

## What Changes

- Replace the current top-header navigation shell with a right-edge, hover-to-open flyout nav; move the theme toggle to a persistent top-right control; add a hexagon avatar (first-letter) that expands to a profile panel on hover.
- Add a catalog of 5 static in-house agent templates (name, description, default prompt, default greeting, default behavior config) as the only starting points for new agents.
- Add the Playground: select a template → customize name, greeting, prompt, and behavior → reset any field to its template default → save as Draft or mark Live.
- **BREAKING**: Dashboard's "Create Agent" entry point now routes to the Playground template picker instead of `/agents/new` (Agent Builder).
- **BREAKING**: Dashboard's "Open / Edit Agent" now routes to the Playground editor instead of `/agents/:id` (Agent Builder), for agents created via a template.
- Dashboard's agent list gains a `draft` status alongside `active`/`inactive`, and shows which template an agent is based on.
- The existing Agent Builder (flow-editor, node-management, tools-management, version-history, testing-console, agent-builder capabilities) is left functionally unchanged and untouched by this change; it is simply unlinked from primary navigation.
- Theme toggle's required location moves from "top navigation bar" to a standalone persistent top-right control, independent of the new flyout nav.

## Capabilities

### New Capabilities
- `nav-shell`: Right-edge hover flyout navigation, persistent top-right theme toggle, hexagon avatar with hover-expand profile panel.
- `static-agent-catalog`: The 5 fixed in-house agent templates and their default configuration data.
- `playground`: Template selection, prompt/greeting/behavior customization, reset-to-default, Draft/Live state for agents created from a template.

### Modified Capabilities
- `dashboard`: Agent List requirement gains a `draft` status value and a template-origin indicator; Create Agent Entry Point and Open/Edit Agent requirements now route into the Playground instead of the Agent Builder.
- `theming`: Dark/Light Mode Toggle requirement's location changes from "top navigation bar" to a standalone persistent top-right control that exists independently of the primary nav (which is no longer a top bar).

## Impact

- **Affected code**: `src/app/shared/app-shell/*` (replaced by new nav-shell components), `src/app/app.routes.ts` (new `/playground` routes, `Create Agent`/`Open Agent` destinations change), `src/app/features/dashboard/*` (status enum, entry points), new `src/app/features/playground/*`, new `src/mocks/agent-templates.mock.ts`.
- **Untouched**: `src/app/features/agent-builder/**` and its child components — remain routable at `/agents/new` and `/agents/:id` for future use, just not linked from nav.
- **Dependencies**: FontAwesome (free) added for icon needs called out in `requirements/Main_Flow.txt`; no Bootstrap — the existing `styles/variables.css` / `styles/globals.css` system is extended instead, to avoid a second competing style system.
- **Systems**: purely client-side/mock; template data and playground drafts live in-memory + mock services, same convention as existing `AgentService`.
