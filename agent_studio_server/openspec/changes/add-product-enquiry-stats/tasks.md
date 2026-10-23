## 1. Server: data model

- [x] 1.1 Add `src/schemas/product-enquiry.schema.ts` (`product_enquiries`, fields per spec, unique `{conversationId, propertyId, stage}`, index `{agentId, propertyId, at}`) and register it in the agents module
- [x] 1.2 Add `src/repos/product-enquiries.repository.ts` with `upsertEvent` (`$setOnInsert`, swallow duplicate-key) and `aggregateStatsForAgent`

## 2. Server: product stats API

- [x] 2.1 Add `ListProductStatsQueryDto` (`fromDate`/`toDate` default last 14 days, `search`, `sort` whitelist, `order`, `page`, `limit`)
- [x] 2.2 Implement `AgentsService.productStats(agentId, companyId, query)`: ownership check (404), aggregation from `sales_properties` with `$lookup`, `channel: 'live'` filter, escaped search regex, sort with name tie-break, `$facet` pagination
- [x] 2.3 Add `@Get(':id/product-stats')` to `agents.controller.ts`
- [x] 2.4 Unit tests: zero-enquiry product, multi-stage conversation counts once per stage, preview excluded, out-of-range dates, search, invalid sort → 400, other company → 404

## 3. Server: preview tagging

- [x] 3.1 `PreviewService.dispatch` adds `channel: 'preview'` to the audio-processor payload

## 4. Gateway (`calls_input_gateway`)

- [x] 4.1 Accept optional `channel` on `POST /twilio/call` and carry it into the session `UserConfig` (via the Twilio stream parameters)
- [x] 4.2 Resolve the channel: `webrtc` → `preview`, explicit `preview` → `preview`, else `live`
- [x] 4.3 Send `callId`, `customerPhNo` (telephony number) and `channel` in the agent WebSocket message in `agent-router.service.ts`

## 5. Agents: live enquiry events (`agent_motor_cycles` first, then port to `agent_real_estate`, `agent_home_appliances`)

- [x] 5.1 Add `src/schema/product-enquiry.schema.ts` (same shape as the server) and `tool/product-enquiry.store.ts` with fire-and-forget `recordProductEnquiry`
- [x] 5.2 Add `callId`, `channel` and `customerPhNo` to `AgentMessage` and the sales state; pass them through `agent.service.ts`
- [x] 5.3 Presentation node: record `discussed` for the focus product, `shortlisted` on shortlist, `purchase_intent` on purchase intent
- [x] 5.4 Closing node: record `purchase_intent` on `agreedToProceed`, `site_visit` when the ticket is raised
- [x] 5.5 Port 5.1–5.4 to `agent_real_estate` (`presentation.node.ts`) and `agent_home_appliances` (`product-presentation.node.ts`)

## 6. Agents: post-call analysis (all three repos)

- [x] 6.1 Store `callId`, `channel` and `customerPhone` on the analysis queue item (`agent.gateway.ts` enqueue plus the schema)
- [x] 6.2 Worker loads the agent's products and passes `[id] name` into the analysis prompt; add `propertiesDiscussedIds` to the output schema and filter it to known ids
- [x] 6.3 Prompt: count only products the customer asked about or that were described to them, not a read-out catalogue list
- [x] 6.4 After `saveSummary`, upsert `discussed` events with `source: 'analysis'`

## 7. Backfill

- [x] 7.1 Add `scripts/backfill-product-enquiries.ts` (`--dry-run`): read `conversation_summaries`, match names to `sales_properties` per agent (normalised exact), upsert `discussed` / `analysis` events at `analyzedAt`; set `channel: 'preview'` when a `call_logs` doc with `_id == conversationId` has provider `webrtc`, else `live`, and report matched/unmatched counts
- [ ] 7.2 Run the dry run against staging, review, then run for real

## 8. Verification

- [ ] 8.1 End to end on staging: a live call discussing two products, shortlisting one and agreeing to buy it → the endpoint shows the expected counts; a playground web call → counts unchanged
- [ ] 8.2 `npm run lint` and `npm test` pass in the server, gateway and the three agent repos
