# Dashboard behavior and operations

The dashboard renders account cash/equity/buying power, positions, open orders, protection status, and advisory signals from `dashboard-snapshot.v1`.

## Failure behavior

- Invalid production configuration fails during `npm run build` with a direct environment-variable error.
- Unsupported schema versions and malformed arrays fail the request; they are never replaced with sample rows.
- A refresh failure keeps the last valid snapshot visible and shows an error banner.
- If the first request fails, the UI shows an unavailable/empty state rather than mock portfolio data.
- Empty `positions`, `openOrders`, and `curatorSignals` arrays remain empty.

## Refresh and language

`VITE_REFRESH_INTERVAL_MS` defaults to 60 seconds and accepts 5 seconds through 15 minutes. The Refresh button performs the same read-only request. Thai/English selection is stored only in browser local storage.

## API contract

Manager must return:

```json
{
  "schemaVersion": "dashboard-snapshot.v1",
  "generatedAt": "2026-07-21T10:00:00Z",
  "mode": "PAPER",
  "brokerMode": "ALPACA",
  "flow": "portfolio_review",
  "account": {},
  "positions": [],
  "openOrders": [],
  "curatorSignals": [],
  "summary": {}
}
```

Only the whitelisted fields normalized by `src/services/api.js` reach UI components. Browser requests use no credentials and explicitly omit cookies.
