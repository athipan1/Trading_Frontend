import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import success from '../../tests/fixtures/dashboard/success.json';
import noCandidate from '../../tests/fixtures/dashboard/no-candidate.json';
import riskRejected from '../../tests/fixtures/dashboard/risk-rejected.json';
import executionSuccess from '../../tests/fixtures/dashboard/execution-success.json';
import executionFailure from '../../tests/fixtures/dashboard/execution-failure.json';
import workflowFailure from '../../tests/fixtures/dashboard/workflow-failure.json';
import cancelled from '../../tests/fixtures/dashboard/cancelled.json';
import stale from '../../tests/fixtures/dashboard/stale.json';
import masked from '../../tests/fixtures/dashboard/masked.json';
import { createDashboardClient, normalizeSnapshot } from './api.js';
import { portfolioSnapshot } from '../data/mockPortfolio.js';

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T00:12:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('dashboard API modes', () => {
  it('returns a v2 internal model in explicit mock mode without fetching', async () => {
    const fetchImpl = vi.fn();
    const client = createDashboardClient({ dataSource: 'mock' }, { fetchImpl });
    const result = await client.getSnapshot();
    expect(result.schemaVersion).toBe('dashboard-snapshot.v2');
    expect(result.sourceSchemaVersion).toBe('dashboard-snapshot.v1');
    expect(result.positions).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('loads a cache-busted public snapshot with no credentials and no-store', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(success));
    const client = createDashboardClient(
      { dataSource: 'public-snapshot', snapshotUrl: 'https://example.com/dashboard.json' },
      { fetchImpl },
    );
    await expect(client.getSnapshot()).resolves.toMatchObject({ mode: 'ALPACA_PAPER' });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.com/dashboard.json?t=1785370320000');
    expect(options).toMatchObject({ cache: 'no-store', credentials: 'omit' });
  });

  it('keeps optional Manager API mode on the versioned endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(success));
    const client = createDashboardClient(
      { dataSource: 'manager-api', managerApiUrl: '/api' },
      { fetchImpl },
    );
    await client.getSnapshot();
    expect(fetchImpl).toHaveBeenCalledWith('/api/dashboard/snapshot', expect.objectContaining({ credentials: 'omit' }));
  });

  it.each([404, 500])('reports HTTP %s without substituting mock data', async (status) => {
    const client = createDashboardClient(
      { dataSource: 'public-snapshot', snapshotUrl: 'https://example.com/dashboard.json' },
      { fetchImpl: vi.fn().mockResolvedValue(response({}, status)) },
    );
    await expect(client.getSnapshot()).rejects.toThrow(`HTTP ${status}`);
  });

  it('reports malformed JSON and request timeout with bounded messages', async () => {
    const malformedClient = createDashboardClient(
      { dataSource: 'public-snapshot', snapshotUrl: 'https://example.com/dashboard.json' },
      { fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockRejectedValue(new SyntaxError('bad')) }) },
    );
    await expect(malformedClient.getSnapshot()).rejects.toThrow('not valid JSON');

    const fetchImpl = vi.fn((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const timeoutClient = createDashboardClient(
      { dataSource: 'public-snapshot', snapshotUrl: 'https://example.com/dashboard.json' },
      { fetchImpl },
    );
    const rejection = expect(timeoutClient.getSnapshot()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10_001);
    await rejection;
  });
});

describe('dashboard-snapshot.v2 contract fixtures', () => {
  it.each([
    ['success', success, 'success', 'not_attempted'],
    ['no candidate', noCandidate, 'success', 'not_attempted'],
    ['risk rejected', riskRejected, 'success', 'not_attempted'],
    ['execution success', executionSuccess, 'success', 'submitted'],
    ['execution failure', executionFailure, 'failure', 'failure'],
    ['workflow failure', workflowFailure, 'failure', 'not_attempted'],
    ['cancelled', cancelled, 'cancelled', 'not_attempted'],
    ['stale', stale, 'success', 'not_attempted'],
    ['masked', masked, 'success', 'not_attempted'],
  ])('normalizes %s', (name, fixture, cycleStatus, executionStatus) => {
    const result = normalizeSnapshot(fixture);
    expect(result.schemaVersion).toBe('dashboard-snapshot.v2');
    expect(result.cycle.status).toBe(cycleStatus);
    expect(result.cycle.executionStatus).toBe(executionStatus);
    expect(result.runtime.liveTradingEnabled).toBe(false);
  });

  it('recalculates stale state from the trusted generatedAt timestamp', () => {
    expect(normalizeSnapshot(success).freshness.isStale).toBe(false);
    expect(normalizeSnapshot(stale).freshness.isStale).toBe(true);
  });

  it('preserves masked nulls instead of rendering them as zero', () => {
    const result = normalizeSnapshot(masked);
    expect(result.account).toMatchObject({ cash: null, equity: null, buyingPower: null, valuesMasked: true });
    expect(result.positions[0].quantity).toBeNull();
    expect(result.privacy.mode).toBe('masked');
  });

  it('supports partial fill without inventing order identifiers', () => {
    const payload = structuredClone(executionSuccess);
    payload.cycle.executionStatus = 'partial_fill';
    payload.cycle.partialFillDetected = true;
    const result = normalizeSnapshot(payload);
    expect(result.cycle.partialFillDetected).toBe(true);
    expect(result.cycle.executionStatus).toBe('partial_fill');
    expect(result.openOrders).toEqual([]);
  });

  it('normalizes Manager-provided order identifiers and lifecycle timestamps', () => {
    const payload = structuredClone(success);
    payload.openOrders[0] = {
      ...payload.openOrders[0],
      order_id: 'manager-order-42',
      submitted_at: '2026-07-30T00:01:00-04:00',
      filled_at: '2026-07-30T00:03:00-04:00',
    };

    expect(normalizeSnapshot(payload).openOrders[0]).toMatchObject({
      id: 'manager-order-42',
      submittedAt: '2026-07-30T04:01:00.000Z',
      updatedAt: '2026-07-30T04:03:00.000Z',
    });
  });

  it('normalizes optional Manager-published agent telemetry', () => {
    const payload = structuredClone(success);
    payload.agents = [{
      agent_id: 'risk_agent',
      name: 'Risk Agent',
      health: 'degraded',
      status: 'rate_limited',
      latency_ms: 140,
      version: '2.1.0',
      cpu_percent: 42.5,
      memory_mb: 768,
      last_run_at: '2026-07-30T07:00:00+07:00',
      internalUrl: 'not-allowlisted',
    }];

    expect(normalizeSnapshot(payload).agents).toEqual([{
      id: 'risk_agent',
      name: 'Risk Agent',
      health: 'degraded',
      status: 'rate_limited',
      latencyMs: 140,
      version: '2.1.0',
      cpuPercent: 42.5,
      memoryPercent: null,
      memoryMb: 768,
      lastRunAt: '2026-07-30T00:00:00.000Z',
    }]);
  });

  it('normalizes only allowlisted optional Manager risk telemetry', () => {
    const payload = structuredClone(success);
    payload.risk = {
      risk_level: 'high',
      risk_score: 72,
      gross_exposure_percent: 48.5,
      net_exposure_percent: -12.25,
      drawdown_percent: 6.2,
      sector_allocation: [{ name: 'Technology', share_percent: 60, market_value: 4000, internalNote: 'dropped' }],
      limits: { gross_exposure_percent: 65, drawdown_percent: 9 },
      emergency_halt: {
        active: true,
        reason: 'Operator-approved safety stop',
        updated_at: '2026-07-30T07:00:00+07:00',
        controlUrl: 'dropped',
      },
      directAgentUrl: 'dropped',
    };

    expect(normalizeSnapshot(payload).risk).toEqual({
      riskLevel: 'high',
      riskScore: 72,
      grossExposurePercent: 48.5,
      netExposurePercent: -12.25,
      drawdownPercent: 6.2,
      sectorAllocation: [{ sector: 'Technology', percent: 60, marketValue: 4000 }],
      limits: { grossExposurePercent: 65, drawdownPercent: 9 },
      emergencyHalt: {
        active: true,
        reason: 'Operator-approved safety stop',
        updatedAt: '2026-07-30T00:00:00.000Z',
      },
    });
  });
});

describe('payload validation and v1 compatibility', () => {
  it('normalizes legacy v1 into the same v2 internal model', () => {
    const result = normalizeSnapshot({
      ...portfolioSnapshot,
      account: { cash_balance: '10.5', portfolio_value: '12', buying_power: '20', apiKey: 'never-return' },
      positions: [{ symbol: 'AAPL', qty: '2', avg_entry_price: '10', current_price: '11', market_value: '22' }],
      openOrders: [],
      curatorSignals: [],
    });
    expect(result.schemaVersion).toBe('dashboard-snapshot.v2');
    expect(result.sourceSchemaVersion).toBe('dashboard-snapshot.v1');
    expect(result.account.cash).toBe(10.5);
    expect(result.positions[0]).toMatchObject({ symbol: 'AAPL', quantity: 2, currentPrice: 11 });
    expect(result.account).not.toHaveProperty('apiKey');
  });

  it('rejects invalid v2 arrays, non-finite numbers and unknown schemas', () => {
    expect(() => normalizeSnapshot({ ...success, positions: {} })).toThrow('positions must be an array');
    expect(() => normalizeSnapshot({ ...success, account: { ...success.account, cash: 'NaN' } })).toThrow('must be finite');
    expect(() => normalizeSnapshot({ ...success, schemaVersion: 'dashboard-snapshot.v3' })).toThrow('Unsupported dashboard schema');
  });

  it('rejects invalid order lifecycle timestamps supplied by Manager', () => {
    const payload = structuredClone(success);
    payload.openOrders[0].submittedAt = 'not-a-timestamp';
    expect(() => normalizeSnapshot(payload)).toThrow('timestamp is invalid');
  });

  it('rejects malformed or out-of-range agent telemetry', () => {
    const invalidCpu = structuredClone(success);
    invalidCpu.agents = [{ id: 'risk', cpuPercent: 101 }];
    expect(() => normalizeSnapshot(invalidCpu)).toThrow('must be between 0 and 100');

    const invalidTimestamp = structuredClone(success);
    invalidTimestamp.agents = [{ id: 'risk', lastRunAt: 'not-a-timestamp' }];
    expect(() => normalizeSnapshot(invalidTimestamp)).toThrow('timestamp is invalid');

    const invalidArray = structuredClone(success);
    invalidArray.agents = {};
    expect(() => normalizeSnapshot(invalidArray)).toThrow('agents must be an array');
  });

  it('rejects malformed or out-of-range risk telemetry', () => {
    const invalidDrawdown = structuredClone(success);
    invalidDrawdown.risk.drawdownPercent = 101;
    expect(() => normalizeSnapshot(invalidDrawdown)).toThrow('between 0 and 100');

    const invalidHalt = structuredClone(success);
    invalidHalt.risk.emergencyHalt.active = 'false';
    expect(() => normalizeSnapshot(invalidHalt)).toThrow('must be a boolean');

    const invalidTimestamp = structuredClone(success);
    invalidTimestamp.risk.emergencyHalt.updatedAt = 'not-a-timestamp';
    expect(() => normalizeSnapshot(invalidTimestamp)).toThrow('timestamp is invalid');

    const invalidAllocation = structuredClone(success);
    invalidAllocation.risk.sectorAllocation = {};
    expect(() => normalizeSnapshot(invalidAllocation)).toThrow('risk.sectorAllocation must be an array');
  });

  it('rejects prototype-pollution keys before rendering', () => {
    const payload = JSON.parse(JSON.stringify(success));
    Object.defineProperty(payload, '__proto__', { value: { polluted: true }, enumerable: true });
    expect(() => normalizeSnapshot(payload)).toThrow('unsafe key');
    expect({}.polluted).toBeUndefined();
  });

  it('limits workflow errors to the allowlisted code and message', () => {
    const payload = structuredClone(workflowFailure);
    payload.error.stack = 'private stack trace';
    payload.error.authorization = 'Bearer secret';
    const result = normalizeSnapshot(payload);
    expect(result.error).toEqual({
      code: 'HOURLY_WORKFLOW_FAILED',
      message: 'Hourly Auto Trading did not complete successfully.',
    });
  });
});
