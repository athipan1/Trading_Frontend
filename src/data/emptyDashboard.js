export const emptyDashboardSnapshot = Object.freeze({
  schemaVersion: 'dashboard-snapshot.v1',
  generatedAt: null,
  mode: 'UNKNOWN',
  brokerMode: 'UNKNOWN',
  flow: 'portfolio_review',
  account: Object.freeze({
    cash: 0,
    equity: 0,
    buyingPower: 0,
    status: 'UNAVAILABLE',
    mode: 'UNKNOWN',
    lastSyncedAt: null,
  }),
  positions: Object.freeze([]),
  openOrders: Object.freeze([]),
  curatorSignals: Object.freeze([]),
  summary: Object.freeze({}),
});
