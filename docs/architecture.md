# Architecture

## Runtime boundary

```text
Browser -> Manager_Agent snapshot or Manager_Agent Web Control
Manager_Agent -> internal agents, database, and Alpaca Paper
```

The browser must not call Execution_Agent, Risk_Agent, Database_Agent,
Profit_Agent, or Alpaca. Production public-snapshot mode is read-only and remains
optional to Hourly Trading.

## Source layout

```text
src/
  App.jsx                 application composition and feature selection
  components/             reusable UI and existing domain panels
  config/                 validated build/runtime configuration
  data/                   explicit empty and development-only mock models
  features/
    agents/               Manager-published Agent telemetry and fixed registry
    dashboard/            Overview page composition
    orders/               Read-only order workspace and observation timeline
    portfolio/            Portfolio page composition
    risk/                 Risk derivation, gauges, allocation, and halt evidence
  hooks/                  reusable polling and route-state hooks
  routes/                 route IDs, paths, and access classification
  services/               sanitized snapshot and Manager-only control clients
  utils/                  locale-safe display helpers and pure view models
```

Feature pages may compose shared components, hooks, and services. Shared layers
must not import feature pages. Services normalize external data before UI code sees
it. New operational fields require a versioned Manager contract and fixtures first.

Portfolio filtering, protection classification, pagination, and safe export are a
pure view-model layer in `src/utils/portfolio.js`. It consumes only the normalized,
read-only Manager snapshot and deliberately carries privacy masking through sorting,
rendering, the detail drawer, and generated files.

Order status classification, pagination, and timeline derivation live in
`src/utils/orders.js`. Unknown broker states remain `other`; the UI never coerces
them into a known lifecycle stage. `src/utils/spreadsheet.js` is the shared export
boundary for Portfolio and Orders, including formula-injection neutralization.

The Agent Monitor joins optional, allowlisted `agents[]` telemetry to a fixed
13-agent registry in `src/features/agents/agentMonitorModel.js`. Unknown agent IDs
are ignored, duplicate records do not override the first Manager record, numeric
resource metrics are range checked, and missing telemetry is displayed as
unavailable. Workflow phases remain separate orchestration evidence.

The Risk Dashboard consumes an optional, allowlisted `risk` projection normalized
by `src/services/api.js`. Manager-published drawdown, risk level, limits, sector
allocation, and emergency-halt state are never inferred when absent. Gross and net
exposure may be calculated from visible position market values and account equity;
privacy masking disables that calculation. The page is read-only and has no direct
Risk_Agent or emergency-control client.

## Routing and loading

The route registry is centralized in `src/routes/routeConfig.js`. Public snapshot
mode exposes Overview, Portfolio, Orders, Agents, Risk, and System Status. Manager-only routes are omitted
from navigation and normalized back to Overview when unavailable.

Agents, Risk, Portfolio, Orders, Finance Ledger, AI Finance, and AI Investment are lazy modules. Public production
does not download these control chunks unless a Manager-enabled deployment opens
their routes.

## Quality gates

- ESLint with zero warnings
- unit coverage for trust-boundary and reusable logic
- production public-snapshot build and bundle secret scan
- production dependency audit
- Docker build, health, and security-header verification
- functional Playwright at mobile/tablet/desktop breakpoints
- axe accessibility gate
- deterministic visual regression baselines
