# Component guide

## Placement

- Put a component in `src/components/` when two or more features can reuse it.
- Put page composition in `src/features/<feature>/`.
- Keep data fetching in hooks/services; presentation components receive normalized
  props and must not call trading agents.
- Put route metadata in `src/routes/routeConfig.js`, never in sidebar markup.

## Component contract

Every new operational component should provide:

1. a visible loading, error, empty, and stale-data state where applicable;
2. semantic headings and landmarks;
3. keyboard-reachable controls with visible focus;
4. text or icons in addition to color for status;
5. mobile behavior down to 320px without horizontal page overflow;
6. deterministic rendering from normalized Manager data;
7. unit/component tests and Playwright coverage for critical journeys.

## Safety rules

- Never render unknown API fields directly.
- Never use `dangerouslySetInnerHTML` for Manager content.
- Never persist an operator token, API key, broker credential, or internal URL.
- Never add direct browser clients for Alpaca or individual agents.
- Treat order and risk controls as Manager-only and fail closed when configuration or
  authorization is missing.

## Performance rules

- Lazy-load route-level Manager tools and future large dashboards.
- Keep derived lists memoized only when profiling shows meaningful work.
- Prefer CSS transitions that honor `prefers-reduced-motion`.
- Add a bundle budget before introducing charting or table-virtualization packages.

## Dashboard insights

`src/features/dashboard/DashboardInsights.jsx` renders only values already present
in the normalized Manager snapshot. Its derivation model is intentionally separate
so privacy and safety rules can be tested without a browser:

- any account, privacy, or position-level masking hides allocation and aggregate P/L;
- long and short positions use absolute exposure for allocation weights;
- the paper-only safety badge appears only when `runtime.liveTradingEnabled` is
  explicitly `false`; missing runtime evidence is shown as unknown, never safe;
- recent activity is derived from the latest Manager phases and does not imply a
  broker execution when a phase was not attempted.

## Application navigation

`src/components/AppNavigation.jsx` owns the desktop sidebar, mobile bottom
navigation, overflow dialog, focus restoration, and skip link. The desktop rail can
be collapsed without changing routes; its preference is stored locally and every
icon-only item retains an accessible name plus a hover/focus tooltip. Mobile
navigation stays independent from the desktop preference.

## Portfolio workspace

`src/features/portfolio/PortfolioPage.jsx` owns the search, strategy/protection
filters, sorting, pagination, view selection, exports, and selected-position state.
`src/components/PositionsTable.jsx` remains presentational so it can render either
table, card, or responsive views without fetching data. `src/utils/portfolio.js`
is the tested derivation and export boundary:

- all rows come from the normalized Manager snapshot;
- account/privacy masking propagates to every position and export;
- masked rows keep source order instead of leaking relative financial values through sorting;
- CSV formula-like strings are neutralized and the Excel download is typed SpreadsheetML;
- the detail drawer traps focus, closes on Escape/backdrop, and restores the trigger focus.
- desktop defaults to the table view and mobile defaults to cards, while operators
  can switch views without changing the underlying result set.

## Orders workspace

`src/features/orders/OrdersPage.jsx` is a read-only projection of normalized
`openOrders`. The page owns search, status/side filters, sorting, pagination, exports,
responsive table/cards, and the snapshot observation timeline. Keep these invariants:

- classify statuses through `src/utils/orders.js`; unknown values remain `other`;
- do not claim an empty Filled/Rejected/Cancelled tab means no historical order existed;
- use Manager timestamps when present and label `generatedAt` as an observation, not a broker event;
- carry account/order privacy masking into quantity, prices, ordering, and exports;
- keep horizontally scrollable tables keyboard-focusable and named as a region.

## Agent Monitor

`src/features/agents/AgentMonitorPage.jsx` renders the fixed registry and optional
Manager telemetry. `agentMonitorModel.js` owns alias matching, health grouping,
deduplication, search, and filtering. Preserve these boundaries:

- never request an individual Agent, Alpaca, database, or internal service URL;
- never infer health, latency, CPU, memory, version, or last run from a workflow phase;
- ignore unknown telemetry IDs instead of rendering arbitrary Manager strings as new agents;
- display every expected agent even when telemetry is unavailable;
- keep the desktop telemetry table keyboard-scrollable and provide equivalent mobile cards.
