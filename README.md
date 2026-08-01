# Trading Frontend

React/Vite dashboard for the multi-agent trading system. The production dashboard is intentionally decoupled from a continuously deployed Manager API.

## Production architecture

```text
Hourly Auto Trading in Manager_Agent
  -> sanitized hourly-auto-trading-report artifact
  -> Publish Dashboard Snapshot workflow
  -> allowlisted dashboard-snapshot.v2 on dashboard-data branch
  -> Trading_Frontend fetches the public HTTPS snapshot
  -> browser refreshes every 60 seconds
```

The frontend remains optional. A frontend outage, Vercel outage, or snapshot publication failure cannot stop or change Hourly Auto Trading. The browser never calls Execution_Agent, Risk_Agent, Database_Agent, Curator_Agent, or Alpaca directly.

Production snapshot URL:

```text
https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json
```

No GitHub token, broker credential, API key, database credential, service URL, or operator token belongs in React source, a `VITE_*` variable, localStorage, or the public JSON.

## Data modes

| `VITE_DATA_SOURCE` | Required variable | Use case |
|---|---|---|
| `public-snapshot` | `VITE_DASHBOARD_SNAPSHOT_URL` | Production read-only dashboard without an always-on Manager API |
| `manager-api` | `VITE_MANAGER_API_URL` | Optional trusted deployment with authenticated Web Control features |
| `mock` | none | Explicit local UI development only |

Production defaults to `public-snapshot` and fails its build when the snapshot URL is missing. It never silently falls back to mock data.

`dashboard-snapshot.v2` includes workflow metadata, Paper runtime, cycle result, phase timeline, freshness, last successful run, masked account state, safe warnings, and a bounded public error. The frontend temporarily accepts `dashboard-snapshot.v1`, converts it to the same internal model, and emits a development-only deprecation warning.

## Vercel production

Use the Vite preset, `npm run build`, and output directory `dist`:

```env
VITE_DATA_SOURCE=public-snapshot
VITE_MANAGER_API_URL=
VITE_DASHBOARD_SNAPSHOT_URL=https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json
VITE_REFRESH_INTERVAL_MS=60000
```

The Vercel Content Security Policy permits snapshot requests only to `raw.githubusercontent.com` and same-origin endpoints. When changing snapshot hosting, update both `VITE_DASHBOARD_SNAPSHOT_URL` and `vercel.json` deliberately.

The client sends `cache: no-store`, adds a timestamp query parameter to bypass stale CDN responses, cancels obsolete requests, prevents overlapping polling, pauses while the tab is hidden, resumes when visible, and preserves the last valid snapshot when a refresh fails.

## Dashboard behavior

The Hourly Automation Status section shows:

- latest run and run number
- scheduled or manual trigger
- Simulator or Alpaca Paper runtime
- workflow and cycle conclusion
- execution attempt, result, reason, candidates, positions, and open orders
- last successful run
- snapshot age and stale warning
- privacy masking status
- GitHub Actions run link
- phase timeline from preflight through final reconciliation

Timestamps use `Asia/Bangkok` for display while retaining absolute ISO timestamps in the contract. Statuses include text and icons, not color alone. The layout is mobile-first down to 320px and supports keyboard navigation and reduced motion.

## Optional Web Control

`manager-api` remains available for trusted environments that deploy Manager_Agent and need the existing finance or planning controls. The operator token is held only in React memory and is never persisted. In `public-snapshot` mode those controls are disabled and the dashboard remains read-only.

Manager deployments must retain fail-closed controls such as:

```env
WEB_CONTROL_ALLOW_EXECUTION=false
WEB_CONTROL_ALLOW_LIVE_EXECUTION=false
```

This frontend does not enable live trading or Profit automatic execution.

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The checked-in local example selects mock mode. To test the production data path locally:

```env
VITE_DATA_SOURCE=public-snapshot
VITE_DASHBOARD_SNAPSHOT_URL=https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json
VITE_REFRESH_INTERVAL_MS=60000
```

## Contract fixtures

`tests/fixtures/dashboard/` contains copied public contract fixtures for:

```text
success.json
no-candidate.json
risk-rejected.json
execution-success.json
execution-failure.json
workflow-failure.json
cancelled.json
stale.json
masked.json
```

Vitest imports every fixture through the real normalizer. Playwright serves the same fixtures as the public snapshot endpoint. This keeps tests reproducible and prevents CI from depending on an unpinned `main` branch.

## Validation

```bash
npm ci
npm run lint
npm test
npm run test:coverage
VITE_DATA_SOURCE=public-snapshot \
VITE_DASHBOARD_SNAPSHOT_URL=https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json \
npm run build
npm run check:bundle
npm audit --omit=dev --audit-level=high
npm run test:e2e
```

The blocking unit-coverage gate protects configuration, API normalization,
polling, incident classification, and formatting modules. The initial ratchet is
90% for statements, functions, and lines and 80% for branches. Rendered UI is
additionally blocked by component tests, functional Playwright tests, axe scans,
and committed visual-regression baselines.

The production dependency audit remains blocking. See [README_MVP.md](README_MVP.md) for legacy dashboard details and [docs/realtime-api-plan.md](docs/realtime-api-plan.md) for optional real-time deployment boundaries.

## Engineering guides

- [Architecture](docs/architecture.md)
- [Component guide](docs/component-guide.md)
- [Developer guide](docs/developer-guide.md)
- [Architecture audit and Phase 1–10 gap map](docs/architecture-audit-2026-08-01.md)
