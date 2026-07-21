// Deliberately synthetic and empty. Mock mode must never resemble a real account.
export const portfolioSnapshot = {
  schemaVersion: 'dashboard-snapshot.v1',
  generatedAt: '2026-01-01T00:00:00Z',
  mode: 'PAPER',
  brokerMode: 'SIMULATOR',
  flow: 'portfolio_review',
  account: {
    cash: 0,
    equity: 0,
    buyingPower: 0,
    status: 'DEMO',
    mode: 'PAPER',
    lastSyncedAt: '2026-01-01T00:00:00Z',
  },
  positions: [],
  openOrders: [],
  curatorSignals: [],
  summary: {
    positionCount: 0,
    openOrderCount: 0,
    curatorSignalCount: 0,
  },
};
