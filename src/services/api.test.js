import { describe, expect, it, vi } from 'vitest';
import { createDashboardClient, normalizeSnapshot } from './api.js';
import { portfolioSnapshot } from '../data/mockPortfolio.js';

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('dashboard API modes', () => {
  it('returns normalized data in explicit mock mode without fetching', async () => {
    const fetchImpl = vi.fn();
    const client = createDashboardClient({ dataSource: 'mock' }, { fetchImpl });
    const result = await client.getSnapshot();
    expect(result.schemaVersion).toBe('dashboard-snapshot.v1');
    expect(result.positions).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('loads public snapshot mode from only the configured snapshot URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(portfolioSnapshot));
    const client = createDashboardClient(
      { dataSource: 'public-snapshot', snapshotUrl: 'https://example.com/dashboard.json' },
      { fetchImpl },
    );
    await expect(client.getSnapshot()).resolves.toMatchObject({ mode: 'PAPER' });
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/dashboard.json', expect.any(Object));
  });

  it('loads Manager API mode through the versioned snapshot endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(portfolioSnapshot));
    const client = createDashboardClient(
      { dataSource: 'manager-api', managerApiUrl: '/api' },
      { fetchImpl },
    );
    await client.getSnapshot();
    expect(fetchImpl).toHaveBeenCalledWith('/api/dashboard/snapshot', expect.objectContaining({ credentials: 'omit' }));
  });

  it('propagates API failures without falling back to mock data', async () => {
    const client = createDashboardClient(
      { dataSource: 'manager-api', managerApiUrl: '/api' },
      { fetchImpl: vi.fn().mockResolvedValue(response({}, 503)) },
    );
    await expect(client.getSnapshot()).rejects.toThrow('HTTP 503');
  });
});

describe('payload normalization', () => {
  it('normalizes numeric aliases and strips unknown fields', () => {
    const result = normalizeSnapshot({
      ...portfolioSnapshot,
      account: { cash_balance: '10.5', portfolio_value: '12', buying_power: '20', apiKey: 'never-return' },
      positions: [{ symbol: 'AAPL', qty: '2', avg_entry_price: '10', current_price: '11', market_value: '22' }],
      openOrders: [],
      curatorSignals: [],
    });
    expect(result.account.cash).toBe(10.5);
    expect(result.positions[0]).toMatchObject({ symbol: 'AAPL', quantity: 2, currentPrice: 11 });
    expect(result.account).not.toHaveProperty('apiKey');
  });

  it('keeps empty positions and orders empty instead of substituting mock rows', () => {
    const result = normalizeSnapshot({ ...portfolioSnapshot, positions: [], openOrders: [], curatorSignals: [] });
    expect(result.positions).toEqual([]);
    expect(result.openOrders).toEqual([]);
  });

  it('rejects malformed payloads and unknown schema versions', () => {
    expect(() => normalizeSnapshot({ ...portfolioSnapshot, positions: {} })).toThrow('positions must be an array');
    expect(() => normalizeSnapshot({ ...portfolioSnapshot, schemaVersion: 'dashboard-snapshot.v2' })).toThrow(
      'Unsupported dashboard schema',
    );
  });
});
