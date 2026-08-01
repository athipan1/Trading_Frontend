import { describe, expect, it } from 'vitest';
import {
  BACKTEST_STRATEGIES,
  deriveBacktestWorkspace,
  validateBacktestRunRequest,
} from './backtestModel.js';

describe('backtest model', () => {
  it('validates and normalizes a bounded Manager run request', () => {
    expect(BACKTEST_STRATEGIES).toEqual(['value_rebound', 'momentum', 'mean_reversion']);
    expect(validateBacktestRunRequest({
      strategy: 'momentum',
      symbols: ' aapl,MSFT,aapl ',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      initialCapital: '50000',
    })).toEqual({
      ok: true,
      value: {
        strategy: 'momentum',
        symbols: ['AAPL', 'MSFT'],
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        initialCapital: 50000,
      },
    });
  });

  it.each([
    [{ strategy: 'unknown', symbols: 'AAPL', startDate: '2026-01-01', endDate: '2026-02-01', initialCapital: 1000 }, 'strategy'],
    [{ strategy: 'momentum', symbols: 'AAPL,$BAD', startDate: '2026-01-01', endDate: '2026-02-01', initialCapital: 1000 }, 'symbols'],
    [{ strategy: 'momentum', symbols: 'AAPL', startDate: '2026-02-01', endDate: '2026-01-01', initialCapital: 1000 }, 'dates'],
    [{ strategy: 'momentum', symbols: 'AAPL', startDate: 'not-a-date', endDate: '2026-02-01', initialCapital: 1000 }, 'dates'],
    [{ strategy: 'momentum', symbols: 'AAPL', startDate: '2026-01-01', endDate: '2026-02-01', initialCapital: 10 }, 'capital'],
  ])('rejects unsafe run input with %s', (input, error) => {
    expect(validateBacktestRunRequest(input)).toEqual({ ok: false, error });
  });

  it('derives a stable responsive profit curve from Manager points', () => {
    const workspace = deriveBacktestWorkspace({
      backtest: {
        latestRun: {
          statistics: { sharpeRatio: 1.2 },
          equityCurve: [
            { timestamp: '2026-01-01T00:00:00Z', equity: 100 },
            { timestamp: '2026-02-01T00:00:00Z', equity: 90 },
            { timestamp: '2026-03-01T00:00:00Z', equity: 120 },
          ],
          trades: [{ id: 'one' }],
        },
        history: [{ id: 'run-one' }],
      },
    });
    expect(workspace.dataPublished).toBe(true);
    expect(workspace.curve.points).toHaveLength(3);
    expect(workspace.curve.points[0]).toMatchObject({ x: 0, y: expect.any(Number) });
    expect(workspace.curve.points.at(-1).x).toBe(100);
    expect(workspace.curve.linePath).toContain('M 0.00');
    expect(workspace.curve.areaPath).toContain('L 100 100 L 0 100 Z');
    expect(workspace.curve.changePercent).toBe(20);
    expect(workspace.statistics.sharpeRatio).toBe(1.2);
    expect(workspace.history).toHaveLength(1);
    expect(workspace.trades).toHaveLength(1);
  });

  it('keeps absent or unusable Manager data explicitly empty', () => {
    const empty = deriveBacktestWorkspace();
    expect(empty).toMatchObject({ dataPublished: false, latestRun: null, history: [], trades: [] });
    expect(empty.curve).toMatchObject({ points: [], linePath: '', min: null, max: null, changePercent: null });

    const single = deriveBacktestWorkspace({
      backtest: { latestRun: { equityCurve: [{ timestamp: '2026-01-01T00:00:00Z', equity: 0 }], trades: [] }, history: [] },
    });
    expect(single.curve.points[0]).toMatchObject({ x: 50, y: 90 });
    expect(single.curve.changePercent).toBeNull();
  });
});
