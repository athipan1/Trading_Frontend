# Trading Frontend

React/Vite control center for the multi-agent trading system. The browser has one service boundary only:

```text
Trading_Frontend -> Manager_Agent -> Database/Risk/Execution/internal agents
```

The frontend never calls Database_Agent, Execution_Agent, Risk_Agent, Curator_Agent, or Alpaca directly. It contains no broker or service credentials and is not required by hourly trading.

## Control Center menus

1. **รายรับรายจ่าย** records personal income and expenses in browser local storage for the first rollout.
2. **AI การเงิน** sends the current ledger and user-defined investment allowance to Manager_Agent for a daily cash-flow summary and advice.
3. **AI ลงทุนและคำสั่งเทรด** shows the broker account, positions, and orders, then asks Manager_Agent to create a dry-run TradePlan. Execution remains blocked until the user reviews the plan and enters the exact PAPER/LIVE confirmation phrase.
4. **ภาพรวมระบบ** preserves the existing read-only portfolio dashboard.

The operator token is entered at runtime and is held only in React memory. It must never be stored in a `VITE_*` variable, local storage, source control, or the built bundle.

## Data modes

| `VITE_DATA_SOURCE` | Required variable | Use case |
|---|---|---|
| `mock` | none | Explicit local UI development only; control actions are disabled |
| `public-snapshot` | `VITE_DASHBOARD_SNAPSHOT_URL` | Read a sanitized static JSON snapshot; control actions are disabled |
| `manager-api` | `VITE_MANAGER_API_URL` | Read the live dashboard and use authenticated Web Control endpoints |

Production defaults to `manager-api` and fails its build when the required URL is missing. It never silently falls back to mock data.

## Manager requirements

Manager_Agent must expose `/web-control/*` and configure:

```env
WEB_CONTROL_OPERATOR_TOKEN=<strong random secret entered by the operator>
WEB_CONTROL_ALLOW_EXECUTION=false
WEB_CONTROL_ALLOW_LIVE_EXECUTION=false
WEB_CONTROL_CONFIRMATION_TTL_SECONDS=900
```

Keep `WEB_CONTROL_ALLOW_EXECUTION=false` until PAPER planning, Risk approval lookup, Database TradePlan lifecycle, and Execution_Agent have been verified end to end. LIVE web execution additionally requires Manager's existing LIVE switches and `WEB_CONTROL_ALLOW_LIVE_EXECUTION=true`.

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

Manager must expose HTTPS and include the Vercel origin in `DASHBOARD_CORS_ALLOWED_ORIGINS`. Never put API keys, Alpaca credentials, database URLs, internal tokens, or the operator token in a `VITE_*` variable: Vite variables are public JavaScript.

See [README_MVP.md](README_MVP.md) for existing dashboard behavior details and [docs/realtime-api-plan.md](docs/realtime-api-plan.md) for deployment boundaries.
