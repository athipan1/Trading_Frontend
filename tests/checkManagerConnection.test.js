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
      brokerMode: 'PAPER',
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
    expect(validateSnapshot(createSnapshot(), { nowMs: NOW, maxAgeMinutes: 180 })).toMatchObject({
      schemaVersion: 'dashboard-snapshot.v2',
      ageMinutes: 60,
      runtime: { liveTradingEnabled: false },
      privacy: { mode: 'masked', valuesMasked: true },
    });
  });

  it('rejects stale snapshots', () => {
    expect(() => validateSnapshot(createSnapshot({ generatedAt: '2026-07-30T00:00:00Z' }), {
      nowMs: NOW,
      maxAgeMinutes: 180,
    })).toThrow('stale');
  });

  it('fails closed when live trading is enabled', () => {
    expect(() => validateSnapshot(createSnapshot({
      runtime: { mode: 'LIVE', brokerMode: 'LIVE', liveTradingEnabled: true },
    }), { nowMs: NOW })).toThrow('liveTradingEnabled');
  });

  it('rejects sensitive fields in the public payload', () => {
    expect(() => validateSnapshot(createSnapshot({ token: 'not-public' }), { nowMs: NOW })).toThrow(
      'Forbidden sensitive field',
    );
  });
});
