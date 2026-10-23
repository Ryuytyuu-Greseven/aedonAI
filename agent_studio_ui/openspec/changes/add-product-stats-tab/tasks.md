## 1. Shared and data layer

- [x] 1.1 Add `SALES_TEMPLATE_IDS` / `isSalesTemplate()` to `shared/constants` (real estate, motorcycles, home appliances) and use it in the playground editor
- [x] 1.2 Add `core/models/product-stats.model.ts` (`ProductStatsRow`, `ProductStatsQuery`, `ProductStatsSort`, `ProductStatsPage`)
- [x] 1.3 Add the `productStats` endpoint and `ApiService.getProductStats(agentId, query)` with API→model mapping
- [x] 1.4 Add `core/services/product-stats.service.ts`

## 2. Read-only properties list

- [x] 2.1 Add `@Input() readOnly = false` to `AgentPropertiesComponent`; hide add/edit/delete and the modal when true
- [x] 2.2 Confirm the playground Properties section is unchanged

## 3. Product Stats component

- [x] 3.1 Scaffold `monitor-agents/product-stats` (ts/html/css) with an `agentId` input
- [x] 3.2 Collapsible products panel with `<app-agent-properties [readOnly]="true">`
- [x] 3.3 Toolbar: debounced search plus 7/14/30-day range presets (default 14)
- [x] 3.4 Table with sortable headers (`aria-sort`, toggle desc/asc), formatted conversion % and last-enquired date
- [x] 3.5 Pagination matching Leads; loading skeleton, empty hint, and error state with Retry

## 4. Monitor Detail integration

- [x] 4.1 Add `'product-stats'` to `MonitorTab`, an `isSalesAgent` computed, the tab button after Overview, and the template branch
- [x] 4.2 Import `ProductStatsComponent` in `MonitorDetailComponent`

## 5. Verification

- [x] 5.1 `ng build` passes with no type errors
- [x] 5.2 Manual: sales agent shows the tab with products and stats; sort/search/range/paging hit the API with the right params; a non-sales agent has no tab; light and dark themes and phone width look right
