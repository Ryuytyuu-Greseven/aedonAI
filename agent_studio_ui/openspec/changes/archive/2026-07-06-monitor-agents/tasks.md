## 1. Call Record Model & Mock Data

- [x] 1.1 Create `src/app/core/models/call-record.model.ts`: `CallRecord { id, agent_id, direction: 'inbound' | 'outbound', occurred_at: string, outcome: 'lead' | 'no_answer' | 'completed' }`.
- [x] 1.2 Create `src/mocks/call-records.mock.ts` with call records for the existing `active`-status mock agents, spread across the last ~14 days, authored so Contact-Centre-style agents skew inbound and Sales-style agents skew outbound (per `requirements/Main_Flow.txt` item 21), roughly within the ~50-100/day scale mentioned in item 20 (doesn't need to hit that volume literally for every mock day, just be representative). (Generated deterministically via a seeded PRNG rather than hand-authored, so the dataset is large/varied but stable across reloads.)
- [x] 1.3 Create `src/app/core/services/call-record.service.ts`: `getStatsForAgent(agentId): Observable<AgentCallStats>` computing `{ total, inbound, outbound, byDay: { date, inbound, outbound }[] }` from the raw mock records, matching the existing `of(...).pipe(delay(300))` convention. Also added `getRecordsForAgent(agentId)` returning raw records — anticipated by this change's own design.md as the integration point the sibling `reporting` change will use, rather than having that change reach into the mock file directly.

## 2. Monitor Agents Feature

- [x] 2.1 Read the `dataviz` skill before building the day-by-day bars/stat tiles in this section. (Used the app's own existing token pair — `--accent` blue / `--warning` amber — for the two series instead of importing the skill's separate hex palette, to keep one consistent color system; applied the skill's mark specs — 2px segment gaps, rounded top-of-stack, always-present 2-series legend, colored dot beside text rather than colored text, native-tooltip hover, and a plain HTML table as the accessible data-complete alternative to the chart.)
- [x] 2.2 Scaffold `src/app/features/monitor-agents/monitor-list/monitor-list.component.ts/.html/.css`: lists `active`-status agents (filter `AgentService.getAgents()` client-side) with total/inbound/outbound counts per card.
- [x] 2.3 Scaffold `src/app/features/monitor-agents/monitor-detail/monitor-detail.component.ts/.html/.css`: shows the summary counts plus a day-by-day inbound/outbound breakdown (CSS-only bars, no charting library) for the trailing window.
- [x] 2.4 Empty state on the list when no agent is `active`.

## 3. Nav & Routing

- [x] 3.1 Add a "Monitor Agents" entry to `NavShellComponent`'s `navItems` array, pointing at `/monitor`.
- [x] 3.2 Add `/monitor` and `/monitor/:agentId` routes to `app.routes.ts` under the existing `authGuard`-protected group.

## 4. Verification

- [x] 4.1 Manually verify: Monitor Agents list shows only `active` agents with correct total/inbound/outbound counts matching the mock data.
- [x] 4.2 Manually verify: opening an agent's detail view shows a legible day-by-day breakdown that doesn't visually break down at the higher end of the mock call volume.
- [x] 4.3 Manually verify: the empty state appears when no agents are active (verified by deactivating all 3 live mock agents from the Dashboard, then confirming Monitor Agents shows the empty state).
- [x] 4.4 Manually verify: "Monitor Agents" nav entry navigates correctly and shows as active on `/monitor` and `/monitor/:agentId`.
- [x] 4.5 Run `ng build` to confirm no regressions; check browser console for errors during the manual verification pass.
