## Why

People monitoring a sales agent can't see which products the agent sells or which ones callers are asking about. The playground shows the Properties list, but the Monitor Detail page doesn't, and there is no per-product traction view. The server is gaining a product enquiry stats API (`agent_studio_server` change `add-product-enquiry-stats`). The UI needs a place to show it.

## What Changes

- New **Product Stats** tab on Monitor Detail, placed right after Overview. It only appears for agents built from one of the three sales templates: `real_estate_sales`, `motor_cycles_sales` or `home_appliances_sales`.
- The tab shows:
  - a collapsible **read-only** product list, using the same list as the playground Properties section;
  - a **stats table**, one row per product: Product, Enquiries, Unique callers, Shortlisted, Purchase intent, Site visits, Conversion %, Last enquired. It has debounced name search, date presets (7 / 14 / 30 days, default 14), sortable column headers and server-side pagination.
- `app-agent-properties` gains a `readonly` input that hides add, edit and delete. The playground behaviour is unchanged.
- New model, service and `ApiService` method for `GET /agents/:id/product-stats`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `monitor-agents`: adds the Product Stats tab requirement (product list plus enquiry stats table) to Monitor Detail.

## Impact

- **New**: `src/app/features/monitor-agents/product-stats/*`, `src/app/core/models/product-stats.model.ts`, `src/app/core/services/product-stats.service.ts`.
- **Modified**: `monitor-detail.component.{ts,html}` (tab and branch), `agent-properties.component.{ts,html}` (`readonly`), `core/http/api.service.ts` and the endpoints constants.
- **Depends on**: the server endpoint from `agent_studio_server` change `add-product-enquiry-stats`. Until real data exists, the table renders products with zero counts.
