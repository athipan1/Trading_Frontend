# Trading Frontend

Read-only React/Vite dashboard for the multi-agent trading system. The browser has one data boundary only:

```text
Trading_Frontend -> Manager_Agent /dashboard/snapshot -> internal agents/broker
```

The frontend never calls Database_Agent, Execution_Agent, Risk_Agent, Curator_Agent, or Alpaca directly. It contains no broker or service credentials and is not required by hourly trading.

## Data modes

| `VITE_DATA_SOURCE` | Required variable | Use case |
|---|---|---|
| `mock` | none | Explicit local UI development only |
| `public-snapshot` | `VITE_DASHBOARD_SNAPSHOT_URL` | Read a sanitized static JSON snapshot |
| `manager-api` | `VITE_MANAGER_API_URL` | Read the live, versioned Manager endpoint |

Production defaults to `manager-api` and fails its build when the required URL is missing. It never silently falls back to mock data.

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The checked-in local example explicitly selects `mock`. To use a local Manager:

```env
VITE_DATA_SOURCE=manager-api
VITE_MANAGER_API_URL=http://localhost:8000
VITE_DASHBOARD_SNAPSHOT_URL=
VITE_REFRESH_INTERVAL_MS=60000
```

## Validation

```bash
npm run lint
npm test
VITE_DATA_SOURCE=manager-api VITE_MANAGER_API_URL=/api npm run build
npm run check:bundle
npm audit --audit-level=high
```

## Docker Compose

Manager_Agent owns `docker-compose.frontend.yml`. It builds this image with `VITE_MANAGER_API_URL=/api`; Nginx proxies that same-origin path to Manager inside the Docker network. Open `http://localhost:5173` after starting the `dashboard` profile.

The image is a pinned Node multi-stage build served by non-root Nginx on port `8080`. `/healthz` is the container health endpoint. API responses are never cached; hashed static assets are cached immutably.

## Vercel production

Use the Vite preset, `npm run build`, and output directory `dist`:

```env
VITE_DATA_SOURCE=manager-api
VITE_MANAGER_API_URL=https://manager.example.com
VITE_DASHBOARD_SNAPSHOT_URL=
VITE_REFRESH_INTERVAL_MS=60000
```

Manager must expose HTTPS and include the Vercel origin in `DASHBOARD_CORS_ALLOWED_ORIGINS`. Never put API keys, Alpaca credentials, database URLs, or internal tokens in a `VITE_*` variable: Vite variables are public JavaScript.

See [README_MVP.md](README_MVP.md) for behavior details and [docs/realtime-api-plan.md](docs/realtime-api-plan.md) for deployment boundaries.
