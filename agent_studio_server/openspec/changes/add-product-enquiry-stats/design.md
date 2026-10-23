## Context

- Products live in `sales_properties` (name plus free-text description), keyed by `agentId`. The same collection is read by all three sales agents.
- Each agent runs a LangGraph sales graph. The presentation node (`Model_Presentation_Node` / `presentation.node` / `product-presentation.node`) tracks the product in focus (`currentPropertyIndex`), `shortlistedPropertyIds` and `purchaseIntentPropertyId`. The closing node confirms intent and raises the site-visit / test-ride ticket. Only `agent_leads.interestedPropertyId` is persisted today.
- Each agent also runs a `conversation-analysis` worker. When a call ends, `agent.gateway.ts` enqueues the transcript, and the worker writes `conversation_summaries.propertiesDiscussed` as **free-text names**.
- `calls_input_gateway` sends `{ sessionId, threadId: sessionId, customerPhNo: '' }` to the agent. The real `callId` (Twilio/Exotel CallSid, or sessionId for webrtc) stays in the gateway.
- Previews reach the agents in two ways: the playground web call (gateway `/ws`, `provider: 'webrtc'`) and the phone preview (`agent_studio_server` `PreviewService` → gateway `POST /twilio/call`, which looks the same as a real outbound call).

## Goals / Non-Goals

**Goals:**
- Count, per product, the conversations that discussed, shortlisted, wanted to buy, or booked a visit for it, without double counting.
- Capture enquiries both live (precise, structured) and after the call (catches mentions the graph never focused on).
- Exclude playground previews.
- Serve a sortable, filterable, paginated stats table cheaply.

**Non-Goals:**
- Fuzzy or LLM matching in the backfill (exact normalised name match only).
- Per-day trend charts per product (can be added later on the same collection).
- Changing how `agent_leads` is written.

## Decisions

1. **An event collection rather than counters on `sales_properties`.** Events allow date-range filtering, distinct-caller counts and stage funnels, and they survive product deletion through the `propertyName` snapshot. Counters can't be filtered by date. *Alternative:* aggregate `call_logs` transcripts at query time. Rejected because it's too expensive and there's no product id in the transcript.

2. **Idempotency through a unique key `(conversationId, propertyId, stage)` and `$setOnInsert` upserts.** The live agent fires on every presentation turn, and analysis re-asserts `discussed` afterwards. Both collapse to one document, and the first writer's `source` and `at` win. Duplicate-key errors are swallowed.

3. **`conversationId` = the agent `sessionId`/`threadId`.** This is already the key used for `agent_leads.leadId` and `conversation_summaries.conversationId`, so all three join cleanly. `callId` is stored separately for linking to `call_logs`.

4. **Live write points:**
   - presentation node, when a focus product exists → `discussed`
   - presentation node, `shortlistProperty` → `shortlisted`
   - presentation or closing node, `purchaseIntent` / `agreedToProceed` → `purchase_intent`
   - closing node, ticket raised → `site_visit`
   - listing nodes don't write: reading out the catalogue isn't an enquiry.

   Writes are fire-and-forget, following the `saveLeadToCrm` pattern, so a database hiccup never stalls a live turn.

5. **Analysis returns ids.** The worker loads the agent's products (`sales-property.repository`) and passes `[id] name` lines into the prompt. The structured output gains `propertiesDiscussedIds: string[]`, filtered against the loaded ids to drop hallucinations. `propertiesDiscussed` names are kept for backwards compatibility.

6. **Channel tagging.** The gateway decides the channel: `provider === 'webrtc'` → `preview`; `/twilio/call` with body `channel: 'preview'` → `preview`; everything else → `live`. `PreviewService` adds `channel: 'preview'` to its payload. The gateway forwards `channel`, `callId` and `customerPhNo` in every agent WebSocket message. The agent keeps them in graph state and the analysis queue item. Preview events are **stored** but filtered at query time, which keeps the data available for debugging. *Alternative:* skip writes for previews. Rejected because it's harder to verify end to end.

7. **Aggregation starts from `sales_properties`.** `$match {agentId, companyId}` → optional name regex → `$lookup` into `product_enquiries` with a pipeline (`agentId`, `propertyId`, `channel: 'live'`, `at` in range) → `$group` per stage with `$addToSet conversationId` → sizes → `$facet` for `total` and the sorted, paginated page. Agents have tens of products, so this stays cheap. The index `{agentId: 1, propertyId: 1, at: -1}` serves the lookup. Endpoint placement: `agents.controller` `@Get(':id/product-stats')`, next to `:id/leads`, reusing the agent ownership check in `AgentsService`.

8. **Query DTO** extends the `ListLeadsQueryDto` naming (`fromDate`, `toDate`, `search`, `page`, `limit`) and adds `sort` (`@IsIn` whitelist) and `order`.

## Risks / Trade-offs

- [LLM marks a product as discussed when it was only listed] → the prompt states that listing the catalogue doesn't count, and live `discussed` only fires for the focus product.
- [Analysis lags 15s or more behind call end] → acceptable for a monitoring table; live events cover the core stages immediately.
- [Agent and gateway deploy order] → older agents ignore the new fields, and the server endpoint simply returns zeros until events exist. Deploy the gateway first, then the agents, then the server and UI.
- [Exact-match backfill misses renamed products] → a dry run reports unmatched names so they can be fixed manually if needed.
- [Historical phone previews can't be told apart from real calls in the backfill] → webrtc previews are detected via `call_logs._id == conversationId`; old phone previews are counted as live (a small, one-time skew).
- [Three copies of the same agent code] → implement in `agent_motor_cycles` first, then port to the other two with the same file names; per-repo differences are limited to node names.

## Migration Plan

1. Create the indexes (Mongoose `autoIndex` on the server schema, and the same schema in the agents).
2. Deploy `calls_input_gateway` → the three agents → `agent_studio_server` → `agent_studio_ui`.
3. Run `scripts/backfill-product-enquiries.ts --dry-run`, review the report, then run it for real.
4. Rollback: hide the UI tab. The collection and fields are additive and can be left in place.

## Open Questions

- None blocking. Previews are excluded and the backfill is approved.
