import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDashboardRuntimeConfigForTests } from '../config/runtimeConfig.js';
import {
  askFinancialAdvisor,
  confirmInvestmentPlan,
  createFinanceEntry,
  createInvestmentPlan,
  deleteFinanceEntry,
  getControlCapabilities,
  getFinanceState,
  getInvestmentPlan,
  getOwnerDashboardSnapshot,
  requestBacktestRun,
  updateFinanceBudgets,
} from './controlApi.js';

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(payload) };
}

const ownerSnapshotV1 = {
  schemaVersion: 'dashboard-snapshot.v1',
  generatedAt: '2026-08-12T07:00:00.000Z',
  mode: 'PAPER',
  brokerMode: 'ALPACA',
  flow: 'portfolio_review',
  account: {
    cash: 12500.25,
    equity: 15120.75,
    buyingPower: 25000.5,
    status: 'ACTIVE',
    mode: 'PAPER',
    lastSyncedAt: '2026-08-12T07:00:00.000Z',
  },
  positions: [],
  openOrders: [],
  curatorSignals: [],
  summary: {
    positionCount: 0,
    openOrderCount: 0,
    curatorSignalCount: 0,
    problemCount: 0,
    dataSource: 'broker_fallback',
    serviceStatus: 'OK',
    executionStatus: null,
    executionReason: null,
  },
};

describe('Manager-only control API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DATA_SOURCE', 'manager-api');
    vi.stubEnv('VITE_MANAGER_API_URL', '/api/');
    resetDashboardRuntimeConfigForTests();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('correlation-id');
  });

  afterEach(() => {
    resetDashboardRuntimeConfigForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('fails closed outside Manager API mode and without an operator token', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'mock');
    resetDashboardRuntimeConfigForTests();
    await expect(getControlCapabilities('token')).rejects.toThrow('manager-api');

    vi.stubEnv('VITE_DATA_SOURCE', 'manager-api');
    resetDashboardRuntimeConfigForTests();
    await expect(getControlCapabilities('')).rejects.toThrow('Operator Token');
  });

  it('sends no-store authenticated requests only to Manager_Agent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { execution_enabled: false } }));
    vi.stubGlobal('fetch', fetchImpl);

    await expect(getControlCapabilities('operator-token')).resolves.toEqual({
      data: { execution_enabled: false },
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/web-control/capabilities', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      headers: expect.objectContaining({
        'X-Operator-Token': 'operator-token',
        'X-Correlation-ID': 'correlation-id',
      }),
    }));
  });

  it('allows only the read-only owner snapshot from public-snapshot mode', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'public-snapshot');
    vi.stubEnv('VITE_DASHBOARD_SNAPSHOT_URL', 'https://example.com/public.json');
    vi.stubEnv('VITE_MANAGER_API_URL', 'https://manager.example.com');
    resetDashboardRuntimeConfigForTests();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(ownerSnapshotV1));
    vi.stubGlobal('fetch', fetchImpl);

    const snapshot = await getOwnerDashboardSnapshot({ operatorToken: 'owner-token', accountId: 'acct/1' });

    expect(snapshot.account.cash).toBe(12500.25);
    expect(snapshot.account.valuesMasked).toBe(false);
    expect(snapshot.privacy).toEqual({ mode: 'full', valuesMasked: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://manager.example.com/web-control/owner-snapshot?account_id=acct%2F1',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        headers: expect.objectContaining({ 'X-Operator-Token': 'owner-token' }),
      }),
    );

    await expect(getControlCapabilities('owner-token')).rejects.toThrow('manager-api');
  });

  it('fails owner view closed when Manager URL or token is missing', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'public-snapshot');
    vi.stubEnv('VITE_DASHBOARD_SNAPSHOT_URL', 'https://example.com/public.json');
    vi.stubEnv('VITE_MANAGER_API_URL', '');
    resetDashboardRuntimeConfigForTests();
    await expect(getOwnerDashboardSnapshot({ operatorToken: 'token', accountId: '1' })).rejects.toThrow('VITE_MANAGER_API_URL');

    vi.stubEnv('VITE_MANAGER_API_URL', 'https://manager.example.com');
    resetDashboardRuntimeConfigForTests();
    await expect(getOwnerDashboardSnapshot({ operatorToken: '', accountId: '1' })).rejects.toThrow('Operator Token');
  });

  it('surfaces bounded Manager error envelopes and malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(
      { error: { message: 'risk rejected' } },
      { ok: false, status: 403 },
    )));
    await expect(getControlCapabilities('token')).rejects.toThrow('risk rejected');

    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 502, json: vi.fn().mockRejectedValue(new Error('bad json')) });
    await expect(getControlCapabilities('token')).rejects.toThrow('ไม่ใช่ JSON');
  });

  it('builds encoded Manager routes and approved request bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: {} }));
    vi.stubGlobal('fetch', fetchImpl);
    const auth = { operatorToken: 'token', accountId: 'acct/1' };

    await getFinanceState(auth);
    await createFinanceEntry({
      ...auth,
      entry: {
        entry_id: 'entry-1',
        entry_type: 'income',
        amount: 100,
        category: 'salary',
        description: 'test',
        occurred_at: '2026-08-01',
      },
    });
    await deleteFinanceEntry({ ...auth, entryId: 'entry/1' });
    await updateFinanceBudgets({ ...auth, personalInvestmentBudgetThb: 5000, tradePlanLimitUsd: 200 });
    await askFinancialAdvisor({ ...auth, message: 'budget' });
    await createInvestmentPlan({ ...auth, ticker: 'AAPL', userGoal: 'paper only' });
    await getInvestmentPlan({ operatorToken: 'token', tradePlanId: 'plan/1' });
    await confirmInvestmentPlan({ ...auth, tradePlanId: 'plan/1', confirmationText: 'CONFIRM' });
    await requestBacktestRun({
      ...auth,
      request: {
        strategy: 'momentum',
        symbols: ['AAPL', 'MSFT'],
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        initialCapital: 50000,
      },
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      '/api/web-control/finance-state?account_id=acct%2F1',
      '/api/web-control/finance-entries',
      '/api/web-control/finance-entries/entry%2F1?account_id=acct%2F1',
      '/api/web-control/finance-budgets/acct%2F1',
      '/api/web-control/financial-advisor-persisted',
      '/api/web-control/investment-plans-persisted',
      '/api/web-control/investment-plans/plan%2F1',
      '/api/web-control/investment-plans/plan%2F1/confirm',
      '/api/web-control/backtests',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual(expect.objectContaining({
      account_id: 'acct/1',
      currency: 'THB',
    }));
    expect(JSON.parse(fetchImpl.mock.calls[5][1].body)).toEqual(expect.objectContaining({
      ticker: 'AAPL',
      period: '1mo',
    }));
    expect(JSON.parse(fetchImpl.mock.calls[8][1].body)).toEqual({
      account_id: 'acct/1',
      strategy: 'momentum',
      symbols: ['AAPL', 'MSFT'],
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      initial_capital: 50000,
    });
  });
});
