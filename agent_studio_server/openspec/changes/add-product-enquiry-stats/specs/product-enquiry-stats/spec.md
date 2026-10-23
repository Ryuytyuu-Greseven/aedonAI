## ADDED Requirements

### Requirement: Product enquiry event model
The system SHALL store product enquiries in a `product_enquiries` collection. Each document SHALL contain `companyId`, `agentId`, `propertyId`, `propertyName` (snapshot at write time), `conversationId`, `callId` (nullable), `customerPhone` (nullable), `stage` (one of `discussed`, `shortlisted`, `purchase_intent`, `site_visit`), `source` (`live` or `analysis`), `channel` (`live` or `preview`) and `at`. The pair (`conversationId`, `propertyId`, `stage`) SHALL be unique.

#### Scenario: Same stage recorded twice for a conversation
- **WHEN** an event with the same `conversationId`, `propertyId` and `stage` is written a second time (by the live agent or by analysis)
- **THEN** no second document is created and the first document's `source` and `at` are preserved

#### Scenario: Product deleted after enquiries
- **WHEN** a product is deleted from `sales_properties` after enquiries were recorded
- **THEN** its enquiry documents remain and still carry the `propertyName` captured at write time

### Requirement: Per-agent product stats endpoint
The system SHALL expose `GET /agents/:id/product-stats`, authenticated and scoped to the caller's company. It SHALL return one row per product currently in `sales_properties` for that agent, with: `propertyId`, `name`, `description`, `enquiries` (distinct conversations with any stage), `uniqueCallers` (distinct non-null `customerPhone`), `shortlisted`, `purchaseIntent`, `siteVisits` (distinct conversations at that stage), `conversionRate` (`purchaseIntent / enquiries`, 0 when there are no enquiries) and `lastEnquiredAt` (nullable). The response SHALL be `{ items, total, page, limit }`.

#### Scenario: Product with no enquiries
- **WHEN** an agent has a product that no conversation has enquired about in the range
- **THEN** that product is returned with all counts 0, `conversionRate` 0 and `lastEnquiredAt` null

#### Scenario: Agent from another company
- **WHEN** a user requests product stats for an agent that does not belong to their company
- **THEN** the system responds with 404

#### Scenario: Multiple stages in one conversation
- **WHEN** one conversation records `discussed`, `shortlisted` and `purchase_intent` for the same product
- **THEN** that product's `enquiries`, `shortlisted` and `purchaseIntent` each increase by exactly 1

### Requirement: Preview traffic excluded
The product stats endpoint SHALL ignore enquiry events whose `channel` is `preview`.

#### Scenario: Playground web call
- **WHEN** a user tests the agent from the playground web call or phone preview and discusses a product
- **THEN** the event is stored with `channel: 'preview'` and does not change any count returned by the endpoint

### Requirement: Filtering, sorting and pagination
The endpoint SHALL accept `fromDate` and `toDate` (ISO dates, inclusive; default: the last 14 days), `search` (case-insensitive substring of the product name, with regex characters escaped), `sort` (one of `name`, `enquiries`, `uniqueCallers`, `shortlisted`, `purchaseIntent`, `siteVisits`, `conversionRate`, `lastEnquiredAt`; default `enquiries`), `order` (`asc` or `desc`; default `desc`), `page` (≥1, default 1) and `limit` (1–100, default 20). Ties SHALL be broken by name ascending.

#### Scenario: Search narrows the result
- **WHEN** the request has `search=pro` and the agent has products "Pro 150" and "Classic 350"
- **THEN** only "Pro 150" is returned and `total` is 1

#### Scenario: Unsupported sort key
- **WHEN** the request has `sort=description`
- **THEN** the system responds with 400

#### Scenario: Date range applies to counts only
- **WHEN** a product's only enquiries fall outside `fromDate`..`toDate`
- **THEN** the product is still returned, with zero counts

### Requirement: Backfill from conversation summaries
A one-off script SHALL create `discussed` events with `source: 'analysis'` from existing `conversation_summaries`. It SHALL match each entry in `propertiesDiscussed` to the agent's current product names (case-insensitive, whitespace-normalised, exact match), and skip unmatched names. It SHALL be safe to re-run, and SHALL support a dry run that reports matched and unmatched counts.

#### Scenario: Re-running the backfill
- **WHEN** the script runs twice over the same summaries
- **THEN** the second run creates no new documents

#### Scenario: Name not found
- **WHEN** a summary lists a name that matches none of the agent's products
- **THEN** no event is created and the name is counted as unmatched in the report
