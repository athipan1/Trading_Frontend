# Trading_Frontend architecture audit — 2026-08-01

Audit base: `main` at `cc5f973` (merged PR #20).

## Executive summary

The repository has a strong read-only production boundary, deterministic snapshot
normalization, responsive tests, axe checks, and visual regression coverage. It is
not yet at the requested Phase 1–10 target: the application remains a small
JavaScript/Vite dashboard with a flat component structure, a 377-line application
orchestrator, more than 2,000 lines of global CSS, and only three public operational
routes. The next work should preserve the existing Manager-only trust boundary and
move feature-by-feature instead of replacing the validated snapshot contract.

## Delivery progress after the audit baseline

The audit remains anchored to PR #20 for traceability. Subsequent production work
has delivered route-level lazy loading, Dashboard insights, responsive and
collapsible navigation, the professional Portfolio workspace, the read-only
Orders workspace, and a Manager-only Agent Monitor. Phase 6 deliberately uses only the current Manager `openOrders`
snapshot: Filled, Rejected, and Cancelled views are supported when Manager publishes
such records, while empty views explicitly avoid claiming complete broker history.

## Inventory and evidence

| Area | Current evidence | Assessment |
|---|---|---|
| Runtime | React 19, Vite 8, JavaScript/JSX | Healthy baseline; TypeScript strict migration remains open |
| Data boundary | `public-snapshot`, optional `manager-api`, mock only when explicit | Strong; browser does not call trading agents or Alpaca |
| Security | allowlisted normalizer, dangerous-key rejection, no-store fetch, CSP, bundle secret scan | Strong; keep fail-closed behavior |
| Accessibility | skip link, focus management, mobile modal containment, axe CI | Strong and blocking |
| Responsive UI | 320/768/1280 Playwright and visual baselines | Strong for current three public routes |
| Testing | 59 unit tests before this phase plus functional, axe, and visual suites | Coverage command was broken and CI did not enforce a threshold |
| Architecture | `App.jsx` owns routing, page composition, control authentication, finance state, and mutations | High coupling; split by feature in Phase 2 |
| Styling | Seven global CSS files; largest files are 502, 493, 412, and 312 lines | Token and feature-layer consolidation required |
| Performance | Single 287.61 kB JS bundle (87.53 kB gzip); no lazy routes | Acceptable today, but scales poorly with Phase 3–10 pages |
| CI | lint, unit, build, audit, Docker, E2E, axe, visual | Add coverage and typecheck; pin third-party actions by commit SHA |
| Documentation | production snapshot and trust boundary documented | Missing architecture, folder, component, and developer guides |

## Findings by severity

### P0 — preserve

- Production must remain read-only and consume only the Manager_Agent published
  `dashboard-snapshot.v2` contract.
- Manager control requests must remain same-origin/approved Manager URL and require
  an in-memory operator token.
- No UI change may create a runtime dependency for Hourly Trading or Alpaca Paper.

### P1 — next implementation phases

1. Split `App.jsx` into `app/`, `routes/`, and feature pages while preserving route
   URLs and test IDs.
2. Add strict TypeScript incrementally at service/config boundaries before feature
   pages; use generated/declared snapshot types as the contract seam.
3. Introduce lazy route modules and Suspense before adding Agents, Risk, Profit,
   Backtest, Market, Logs, and Settings.
4. Add portfolio search, filter, sort, pagination, export, and detail views using
   normalized Manager data only.
5. Extend the Manager snapshot contract before rendering agent telemetry, risk
   gauges, backtest statistics, or order-history states. Do not synthesize live
   operational data in the browser.

### P2 — hardening backlog

- Raise branch coverage from the initial 80% ratchet to 90% while retaining at
  least 90% statements, functions, and lines.
- Pin GitHub Actions and container base images to immutable revisions/digests.
- Consolidate CSS into design tokens, primitives, layout, and feature layers.
- Add dependency/circular-import analysis and bundle-size budgets to CI.
- Replace the hand-rolled History API router only when the migration improves route
  boundaries without weakening the static Vercel deployment.

## Phase mapping

| Requested phase | Status on audited main | Delivery direction |
|---|---|---|
| 1 Audit | In progress in this PR | Report plus executable quality gate |
| 2 Architecture | In progress | Feature folders, route registry, lazy loading delivered; strict TypeScript migration remains |
| 3 Dashboard | In progress | Operational insights, allocation, performance and activity delivered; richer charting remains |
| 4 Sidebar | Delivered | Responsive desktop/mobile navigation, collapse state, overflow dialog and keyboard support |
| 5 Portfolio | Delivered | Table/cards, search/filter/sort, pagination, safe exports and focus-managed detail |
| 6 Orders | Delivered for current contract | Status views, search/filter/sort, pagination, safe exports and honest snapshot timeline; full history still requires Manager data |
| 7 Agents | Delivered with optional contract | All 13 expected agents render; bounded Manager `agents[]` telemetry is used when published and missing fields remain explicitly unavailable |
| 8 Risk | Not started | Requires Manager risk snapshot contract |
| 9 Backtest | Not started | Requires Manager backtest summary contract |
| 10 Settings | Not started | Theme/language/refresh preferences can be client-side; API URL stays build-time validated |

## Validation baseline

- `npm run lint`: pass
- `npm test`: 59/59 pass on audited `main`
- `npm run build` in public-snapshot mode: pass; 287.61 kB JS / 87.53 kB gzip
- bundle secret scan: pass
- production dependency audit: zero vulnerabilities
- local Playwright: blocked only because the sandbox browser binary was not yet
  installed; PR CI remains the authoritative Linux browser gate
