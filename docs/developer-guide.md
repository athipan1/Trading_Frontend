# Developer guide

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Mock mode must remain explicit. Use the documented public snapshot URL when testing
the production read-only path.

## Required validation

```bash
npm run lint
npm run test:coverage
VITE_DATA_SOURCE=public-snapshot \
VITE_MANAGER_API_URL= \
VITE_DASHBOARD_SNAPSHOT_URL=https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json \
npm run build
npm run check:bundle
npm audit --omit=dev --audit-level=high
npm run test:e2e
```

Intentional visual changes require `npm run test:visual:update`, manual inspection of
every changed image, and baseline files committed in the same PR. CI never rewrites
visual baselines.

Portfolio changes must cover the pure workspace model, component interactions, and
the Playwright journey for search, view switching, focus-managed details, and file
download. Test exports with formula-like symbols and masked financial values; never
assert privacy only from CSS visibility.

Order changes must test every lifecycle category, unknown-status fallback, empty
history messaging, formula-safe masked exports, mobile cards, keyboard-accessible
table scrolling, and the distinction between Manager timestamps and snapshot
observation time.

Agent Monitor changes must cover the fixed 13-agent registry, alias matching,
health grouping, missing telemetry, invalid resource ranges, invalid timestamps,
desktop table/mobile cards, and the Manager-only boundary. Optional `agents[]`
fixtures may exercise the UI, but absent telemetry must never be replaced with
derived or mocked production values.

Risk Dashboard changes must cover published and absent optional `risk` contracts,
bounded percentages, emergency-halt booleans/timestamps, masked exposure, sector
fallbacks, mobile overflow, and the lack of a browser halt control. Fixtures may
publish risk evidence through Manager, but tests must prove that drawdown and risk
level remain unavailable when Manager omits them.

Backtest changes must cover request allowlists, date/capital bounds, disabled public
mode, Manager capability gating, optional/oversized contract payloads, invalid
metrics/timestamps, profit-curve derivation, empty states, desktop tables, mobile
cards, and the fact that simulated trades never become broker instructions.

When the pinned Playwright browser cannot be installed in a restricted local
environment, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible Chromium
executable. CI leaves this unset and always installs the Playwright-pinned browser.

## Adding a route

1. Add the route ID/path to `src/routes/routeConfig.js`.
2. Add translated navigation copy in `src/i18n.js`.
3. Create a page under `src/features/<feature>/`.
4. Compose it in `App.jsx`; use `React.lazy` for large or restricted features.
5. Add route, keyboard, 320px overflow, accessibility, and visual coverage.
6. If new data is required, version the Manager contract and add copied fixtures
   before rendering it.

## Pull requests

Keep one user-visible feature or foundation change per PR. Every PR must state its
Manager/Alpaca safety boundary, list validation commands, and pass all blocking
GitHub Actions before merge.
