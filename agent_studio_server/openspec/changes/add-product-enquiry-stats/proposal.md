## Why

Sales agents (motorcycles, real estate, home appliances) pitch products from `sales_properties`, but nothing records which products callers actually enquire about. Business owners monitoring an agent can't tell which products get traction. The only existing signal, `agent_leads.interestedPropertyId`, captures final purchase intent alone (one per session) and misses every product that was merely discussed or shortlisted.

## What Changes

- New shared collection `product_enquiries`: one event per (conversation, product, stage). It is written by the three sales agents during the call (live) and by their post-call conversation-analysis worker (catch-up), and records the call channel so playground previews can be excluded.
- New endpoint `GET /agents/:id/product-stats`: per-product enquiry aggregates for an agent, with date range, name search, sort and pagination. Products with zero enquiries are included, and preview traffic is excluded.
- Preview relay (`PreviewService`) tags outbound preview calls with `channel: 'preview'` so downstream services can tell them apart from real customer calls.
- One-off backfill script that converts existing `conversation_summaries.propertiesDiscussed` names into `discussed` enquiry events by matching them to the agent's current property names.
- Cross-repo (tracked as tasks here; those repos have no OpenSpec):
  - `agent_motor_cycles`, `agent_real_estate`, `agent_home_appliances`: record live enquiry events from the presentation and closing nodes, and make conversation analysis return property **ids** and write `analysis` events.
  - `calls_input_gateway`: forward `callId`, `customerPhNo` and `channel` to the agent, and accept a `channel` on `/twilio/call`.

## Capabilities

### New Capabilities
- `product-enquiry-stats`: the product enquiry event model and the per-agent product stats API (aggregation, filtering, sorting, pagination, preview exclusion, backfill).

### Modified Capabilities
<!-- None: preview relay payload gains an optional field; no spec-level behavior change to existing capabilities. -->

## Impact

- **New code**: `src/schemas/product-enquiry.schema.ts`, `src/repos/product-enquiries.repository.ts`, a product-stats DTO, a controller route and service method (under `agents`), and `scripts/backfill-product-enquiries.ts`.
- **Modified code**: `src/agents/preview.service.ts` (payload gains `channel`).
- **Database**: new collection `product_enquiries` with a unique index `{conversationId, propertyId, stage}` and a query index `{agentId, at}`.
- **API**: new read-only route; no breaking changes.
- **Other repos**: the three agent services and `calls_input_gateway` (see tasks). The UI work is tracked separately in `agent_studio_ui` change `add-product-stats-tab`.
