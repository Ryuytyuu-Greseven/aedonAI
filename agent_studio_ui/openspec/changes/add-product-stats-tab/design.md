## Context

Monitor Detail (`monitor-detail.component`) switches tabs with a `MonitorTab` signal union. Leads is the closest existing pattern for a server-paginated list: signals for page and total, plus a loading skeleton. The playground's `app-agent-properties` fetches and renders the agent's products, with CRUD actions and a modal. The sales agents' template ids are `real_estate_sales`, `motor_cycles_sales` and `home_appliances_sales`; each runs on its own agent server. On `Agent` it is available as `base_template_id`.

## Goals / Non-Goals

**Goals:** reuse the existing properties list unchanged apart from a read-only mode; build a table that matches the design system and existing tables (`breakdown-table` styles); keep state in signals.

**Non-Goals:** per-product charts or trends, CSV export, editing products from Monitor, and linking from a product row to its calls (possible later via `callId`).

## Decisions

1. **`readonly` input on `AgentPropertiesComponent`** rather than a new list component. It's a single source of truth for how products look. `readonly` hides the header "Add" button, the row edit/delete actions and the modal.
2. **Sales template ids live in `shared/constants/agent-templates.constant.ts`** (`SALES_TEMPLATE_IDS`, `isSalesTemplate()`), shared by the playground Properties section and the monitor tab. The tab is shown by `computed(() => isSalesTemplate(agent()?.base_template_id))`.
3. **`ProductStatsComponent` (`app-product-stats`, input `agentId`)** owns the query state: `search`, `rangeDays`, `sort`, `order` and `page` signals. A single `effect`/`toObservable` pipeline with `debounceTime(300)` on search and `switchMap` to the service cancels stale requests.
4. **Table markup** uses the shared table/`breakdown-table` styles inside a `card`. Header cells are buttons with `aria-sort`. Numeric columns are right-aligned. Conversion is rendered as a percentage, and Last enquired as a relative date with the absolute date in `title`.
5. **Layout**: a collapsible "Products (n)" `<details>` panel holding `<app-agent-properties [readOnly]="true">`, then a toolbar (search plus range segmented control), then the table and pager. On narrow screens the table scrolls horizontally inside its wrapper.

## Risks / Trade-offs

- [Server endpoint not deployed yet] → the service maps errors to the error state; if needed during development, a mock in `src/mocks` mirrors the API shape.
- [Two requests on tab open (properties plus stats)] → acceptable; both are small and independent.
