// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SNAPSHOT_URL,
  validateEndpointUrl,
  validateSnapshot,
} from '../scripts/check-manager-connection.mjs';

const NOW = Date.parse('2026-07-30T05:20:00Z');

function createSnapshot(overrides = {}) {
  return {
    schemaVersion: 'dashboard-snapshot.v2',
    generatedAt: '2026-07-30T04:20:00Z',
    workflow: {
      runId: 30510843903,
      runNumber: 608,
      runUrl: 'https://github.com/athipan1/Manager_Agent/actions/runs/30510843903',
      status: 'completed',
      conclusion: 'success',
    },
    runtime: {
      mode: 'PAPER',
      brokerMode: 'ALPACA',
      liveTradingEnabled: false,
    },
    cycle: {},
    summary: {},
    positions: [],
    openOrders: [],
    freshness: {
      expectedIntervalMinutes: 60,
      staleAfterMinutes: 120,
      isStale: false,
    },
    privacy: {
      mode: 'masked',
      valuesMasked: true,
    },
    ...overrides,
  };
}

describe('Manager connection validation', () => {
  it('accepts only the approved HTTPS Manager_Agent snapshot URL', () => {
    expect(validateEndpointUrl(DEFAULT_SNAPSHOT_URL).toString()).toBe(DEFAULT_SNAPSHOT_URL);
    expect(() => validateEndpointUrl('http://raw.githubusercontent.com/test.json')).toThrow('HTTPS');
    expect(() => validateEndpointUrl(`${DEFAULT_SNAPSHOT_URL}?token=unsafe`)).toThrow('query');
  });

  it('accepts a fresh masked snapshot with live trading disabled', () => {
    expect(
      validateSnapshot(createSnapshot(), {
        nowMs: NOW,
        maxAgeMinutes: 180,
        freshnessPolicy: 'fail',
      }),
    ).toMatchObject({
      schemaVersion: 'dashboard-snapshot.v2',
      ageMinutes: 60,
      runtime: { liveTradingEnabled: false },
      privacy: { mode: 'masked', valuesMasked: true },
      freshness: { isStale: false, policy: 'fail', warnings: [] },
      agentTelemetryCount: 0,
      riskTelemetryPublished: false,
      backtestTelemetry: { published: false, historyCount: 0, curvePointCount: 0, tradeCount: 0 },
    });
  });

  it('validates optional bounded Agent telemetry without requiring it', () => {
    const result = validateSnapshot(createSnapshot({
      agents: [{
        id: 'manager_agent',
        latencyMs: 25,
        cpuPercent: 18,
        memoryMb: 410,
        lastRunAt: '2026-07-30T04:20:00Z',
      }],
    }), { nowMs: NOW, freshnessPolicy: 'warn' });
    expect(result.agentTelemetryCount).toBe(1);

    expect(() => validateSnapshot(createSnapshot({
      agents: [{ id: 'risk_agent', cpuPercent: 101 }],
    }), { nowMs: NOW, freshnessPolicy: 'warn' })).toThrow('between 0 and 100');
  });

  it('validates optional bounded risk telemetry without exposing a control channel', () => {
    const result = validateSnapshot(createSnapshot({
      risk: {
        riskLevel: 'moderate',
        riskScore: 35,
        grossExposurePercent: 28,
        netExposurePercent: -4,
        drawdownPercent: 2.5,
        sectorAllocation: [{ sector: 'Technology', percent: 55 }],
        limits: { grossExposurePercent: 70, drawdownPercent: 10 },
        emergencyHalt: { active: false, updatedAt: '2026-07-30T04:20:00Z' },
      },
    }), { nowMs: NOW, freshnessPolicy: 'warn' });
    expect(result.riskTelemetryPublished).toBe(true);

    expect(() => validateSnapshot(createSnapshot({
      risk: { drawdownPercent: 120 },
    }), { nowMs: NOW, freshnessPolicy: 'warn' })).toThrow('between 0 and 100');
    expect(() => validateSnapshot(createSnapshot({
      risk: { emergencyHalt: { active: 'false' } },
    }), { nowMs: NOW, freshnessPolicy: 'warn' })).toThrow('must be a boolean');
  });

  it('validates optional bounded backtest evidence without accepting broker identifiers', () => {
    const result = validateSnapshot(createSnapshot({
      backtest: {
        latestRun: {
          id: 'bt-1',
          status: 'completed',
          strategy: 'momentum',
          symbols: ['AAPL'],
          startedAt: '2026-01-01T00:00:00Z',
          completedAt: '2026-02-01T00:00:00Z',
          statistics: { sharpeRatio: 1.2, winRatePercent: 60, maxDrawdownPercent: 5, totalTrades: 2 },
          equityCurve: [{ timestamp: '2026-01-01T00:00:00Z', equity: 10000, drawdownPercent: 0 }],
          trades: [{ symbol: 'AAPL', quantity: 1, entryPrice: 100, exitPrice: 110, pnl: 10 }],
        },
        history: [{ id: 'bt-1', statistics: {} }],
      },
    }), { nowMs: NOW, freshnessPolicy: 'warn' });
    expect(result.backtestTelemetry).toEqual({
      published: true,
      historyCount: 1,
      curvePointCount: 1,
      tradeCount: 1,
    });

    expect(() => validateSnapshot(createSnapshot({
      backtest: { latestRun: { statistics: { winRatePercent: 101 } }, history: [] },
    }), { nowMs: NOW, freshnessPolicy: 'warn' })).toThrow('between 0 and 100');
    expect(() => validateSnapshot(createSnapshot({
      backtest: { latestRun: { trades: [{ symbol: 'AAPL', brokerOrderId: 'secret' }] }, history: [] },
    }), { nowMs: NOW, freshnessPolicy: 'warn' })).toThrow('Forbidden sensitive field');
  });

  it('reports stale upstream data as a warning when connectivity policy is warn', () => {
    const result = validateSnapshot(
      createSnapshot({ generatedAt: '2026-07-30T00:00:00Z' }),
      {
        nowMs: NOW,
        maxAgeMinutes: 180,
        freshnessPolicy: 'warn',
      },
    );

    expect(result.freshness).toMatchObject({ isStale: true, policy: 'warn' });
    expect(result.warnings[0]).toContain('stale');
    expect(result.runtime.liveTradingEnabled).toBe(false);
  });

  it('rejects stale snapshots when strict freshness is requested', () => {
    expect(() =>
      validateSnapshot(createSnapshot({ generatedAt: '2026-07-30T00:00:00Z' }), {
        nowMs: NOW,
        maxAgeMinutes: 180,
        freshnessPolicy: 'fail',
      }),
    ).toThrow('stale');
  });

  it('preserves a publisher stale warning even when age is within the local limit', () => {
    const result = validateSnapshot(
      createSnapshot({
        freshness: {
          expectedIntervalMinutes: 60,
          staleAfterMinutes: 120,
          isStale: true,
        },
      }),
      { nowMs: NOW, maxAgeMinutes: 180, freshnessPolicy: 'warn' },
    );

    expect(result.freshness.isStale).toBe(true);
    expect(result.warnings).toContain('Manager snapshot reports freshness.isStale=true');
  });

  it('fails closed when live trading is enabled even under warning freshness policy', () => {
    expect(() =>
      validateSnapshot(
        createSnapshot({
          generatedAt: '2026-07-30T00:00:00Z',
          runtime: { mode: 'LIVE', brokerMode: 'LIVE', liveTradingEnabled: true },
        }),
        { nowMs: NOW, freshnessPolicy: 'warn' },
      ),
    ).toThrow('liveTradingEnabled');
  });

  it('rejects sensitive fields in the public payload', () => {
    expect(() =>
      validateSnapshot(createSnapshot({ token: 'not-public' }), {
        nowMs: NOW,
        freshnessPolicy: 'warn',
      }),
    ).toThrow('Forbidden sensitive field');

    expect(() => validateSnapshot(createSnapshot({
      agents: [{ id: 'risk_agent', internalUrl: 'http://risk-agent:8000' }],
    }), { nowMs: NOW, freshnessPolicy: 'warn' })).toThrow('Forbidden sensitive field');
  });
});
