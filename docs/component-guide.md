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
