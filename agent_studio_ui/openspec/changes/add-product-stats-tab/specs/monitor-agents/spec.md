## ADDED Requirements

### Requirement: Product Stats Tab
The Monitor Detail page SHALL show a "Product Stats" tab directly after "Overview" for agents whose `base_template_id` is one of the sales templates (`real_estate_sales`, `motor_cycles_sales`, `home_appliances_sales`), and SHALL NOT show it for other agents. The tab SHALL contain a read-only list of the agent's products (name and description, as shown in the playground Properties section) and a product enquiry stats table.

#### Scenario: Sales agent
- **WHEN** the user opens Monitor Detail for an agent created from the `real_estate_sales`, `motor_cycles_sales` or `home_appliances_sales` template
- **THEN** the tabs read Overview, Product Stats, Call Log, Leads, Reports

#### Scenario: Non-sales agent
- **WHEN** the user opens Monitor Detail for an agent from any other template
- **THEN** no Product Stats tab is shown

#### Scenario: Product list is read-only
- **WHEN** the user views the product list in the Product Stats tab
- **THEN** no add, edit or delete controls are shown

### Requirement: Product Enquiry Stats Table
The Product Stats tab SHALL show one row per product with columns Product, Enquiries, Unique callers, Shortlisted, Purchase intent, Site visits, Conversion % and Last enquired, loaded from `GET /agents/:id/product-stats`. It SHALL default to the last 14 days sorted by Enquiries descending, and SHALL offer 7 / 14 / 30-day presets. Sorting, search and pagination SHALL be performed by the server.

#### Scenario: Sort by a column
- **WHEN** the user clicks the "Purchase intent" header
- **THEN** the table reloads sorted by purchase intent descending; a second click sorts ascending; the active column shows a direction indicator

#### Scenario: Search
- **WHEN** the user types a product name in the search box
- **THEN** after a short debounce the table reloads, filtered to matching products, and resets to page 1

#### Scenario: Change date range
- **WHEN** the user selects "Last 30 days"
- **THEN** the table reloads with counts for that range and resets to page 1

#### Scenario: Pagination
- **WHEN** there are more products than the page size
- **THEN** Previous/Next controls and a "Page X of Y" label are shown, matching the Leads tab

#### Scenario: No enquiries yet
- **WHEN** the agent has products but no enquiries in the range
- **THEN** all products are listed with zero counts, "—" for Last enquired, and a hint that stats fill in as calls come in

#### Scenario: Load failure
- **WHEN** the stats request fails
- **THEN** an error message with a Retry button is shown in place of the table
