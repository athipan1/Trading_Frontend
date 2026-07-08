# Trading Frontend

React + Vite dashboard for the AI trading agent system.

## MVP scope

- Portfolio metrics: cash, equity, buying power, position value
- Dynamic positions table from snapshot data
- Open orders / bracket protection view
- Curator signal panel
- Mock data by default so the app can deploy before production APIs are exposed

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` for local development.

```env
VITE_USE_MOCK_DATA=true
VITE_DASHBOARD_SNAPSHOT_URL=https://raw.githubusercontent.com/athipan1/Manager_Agent/main/docs/dashboard/latest-dashboard-snapshot.json
VITE_MANAGER_API_URL=
VITE_DATABASE_API_URL=
VITE_EXECUTION_API_URL=
VITE_DASHBOARD_REFRESH_MS=30000
```

Keep all secret API keys out of the browser. If an agent endpoint needs a secret, call it through a backend/proxy instead of exposing the key in Vercel public environment variables.

## Public snapshot mode

After `Manager_Agent` publishes `docs/dashboard/latest-dashboard-snapshot.json`, Vercel can use the static JSON file as the dashboard data source:

```env
VITE_USE_MOCK_DATA=false
VITE_DASHBOARD_SNAPSHOT_URL=https://raw.githubusercontent.com/athipan1/Manager_Agent/main/docs/dashboard/latest-dashboard-snapshot.json
```

This is near-realtime. The dashboard updates whenever the Manager workflow publishes a fresh JSON snapshot, and the frontend polls it using `VITE_DASHBOARD_REFRESH_MS`.

## Vercel deployment

Recommended settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Start with mock data enabled, then flip `VITE_USE_MOCK_DATA=false` after the public snapshot file exists.
