# Manager dashboard integration

## Trust boundary

```text
Browser / static hosting
        |
        | GET /dashboard/snapshot (read-only, versioned, sanitized)
        v
Manager_Agent
        |
        +-- Database_Agent / trading agents / Alpaca (server-side only)
```

Direct browser calls to individual agents are forbidden. Internal URLs and credentials remain server-side. The dashboard cannot create, modify, cancel, or execute orders.

## Environment matrix

| Environment | Data source | Manager URL |
|---|---|---|
| Local UI work | `mock` explicitly | empty |
| Local Manager | `manager-api` | `http://localhost:8000` |
| Docker Compose | `manager-api` | `/api` |
| GitHub Actions | `manager-api` | `/api` |
| Vercel | `manager-api` | public Manager HTTPS URL |
| Static snapshot hosting | `public-snapshot` | snapshot URL instead |

Examples are provided in `.env.example`, `.env.docker.example`, `.env.github-actions.example`, and `.env.production.example`.

## Deployment order and rollback

1. Deploy Manager with `dashboard-snapshot.v1`, HTTPS, CORS allowlist, and rate protection.
2. Verify the public endpoint contains no identifiers or secrets.
3. Deploy the frontend with `manager-api` and the public HTTPS Manager URL.
4. Roll back the frontend independently if needed; backend trading continues because no runtime dependency points to the frontend.
5. To roll back the API, first return the frontend to `public-snapshot` using an existing sanitized v1 snapshot.

Known limitation: Vite configuration is embedded at build time. Changing the Manager URL or data source requires a new frontend build.
