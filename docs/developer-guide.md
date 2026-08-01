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
