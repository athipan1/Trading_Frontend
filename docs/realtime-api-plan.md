# Realtime API Integration Plan

The dashboard starts with mock data and is designed to switch to live agent APIs without hardcoding symbols.

## Target agent sources

| Source | Purpose | Frontend data |
|---|---|---|
| Manager_Agent | Portfolio run report, execution summary, Curator signals | dashboard snapshot, selected positions, risk approvals |
| Database_Agent | Persisted positions, orders, broker sync snapshot | positions, open orders, bucket exposure |
| Execution_Agent | Broker account, positions, open orders | cash, equity, buying power, live broker state |
| Risk_Agent | Risk approvals and guardrails | risk status, quantity, approval IDs |
| Curator_Agent | Advisory skills and signals | signal, confidence, explanation |

## CI checks

`Frontend CI` has two jobs:

1. `Build frontend` installs dependencies and builds the Vite app.
2. `Agent API connectivity` runs `scripts/check-agent-apis.mjs`.

The API connectivity job is currently non-blocking because public/proxy URLs may not exist yet. After endpoints are stable, set:

```env
API_CHECK_STRICT=true
```

## Required GitHub repository variables

Configure these in GitHub repository settings under Actions variables:

```env
MANAGER_API_URL=
DATABASE_API_URL=
EXECUTION_API_URL=
RISK_API_URL=
CURATOR_API_URL=
```

## Optional GitHub repository secret

```env
AGENT_API_KEY=
```

Do not expose secret keys to browser-side Vite variables. Use backend/proxy endpoints for authenticated agent calls.

## Frontend runtime env

Vercel can use:

```env
VITE_USE_MOCK_DATA=true
VITE_MANAGER_API_URL=
VITE_DATABASE_API_URL=
VITE_EXECUTION_API_URL=
```

When live proxy APIs are ready, switch `VITE_USE_MOCK_DATA=false`.
