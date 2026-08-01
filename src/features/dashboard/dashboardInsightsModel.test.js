import { describe, expect, it } from 'vitest';
import { deriveDashboardInsights } from './dashboardInsightsModel.js';

describe('dashboard insight derivation', () => {
  it('sorts allocation, totals unrealized P/L, and keeps the latest phases first', () => {
    const insights = deriveDashboardInsights({
      runtime: { liveTradingEnabled: false },
      workflow: { conclusion: 'success' },
      account: { valuesMasked: false },
      positions: [
        { symbol: 'MSFT', marketValue: 300, unrealizedPnL: 15, valuesMasked: false },
        { symbol: 'AAPL', marketValue: 700, unrealizedPnL: -5, valuesMasked: false },
      ],
      phases: [
        { name: 'preflight', status: 'success' },
        { name: 'scanner', status: 'success' },
        { name: 'risk', status: 'failure' },
        { name: 'execution', status: 'not_attempted' },
        { name: 'final_reconciliation', status: 'success' },
      ],
    });

    expect(insights.allocations).toEqual([
      { symbol: 'AAPL', marketValue: 700, share: 0.7 },
      { symbol: 'MSFT', marketValue: 300, share: 0.3 },
    ]);
    expect(insights.unrealizedPnL).toBe(10);
    expect(insights.recentPhases.map((phase) => phase.name)).toEqual([
      'final_reconciliation', 'execution', 'risk', 'scanner',
    ]);
    expect(insights.safetyState).toBe('safe');
  });

  it('does not expose allocation or P/L when financial values are masked', () => {
    const insights = deriveDashboardInsights({
      runtime: { liveTradingEnabled: true },
      privacy: { valuesMasked: true },
      positions: [{ symbol: 'SECRET', marketValue: 100, unrealizedPnL: 20 }],
      phases: null,
    });

    expect(insights.allocations).toEqual([]);
    expect(insights.unrealizedPnL).toBeNull();
    expect(insights.valuesMasked).toBe(true);
    expect(insights.safetyState).toBe('critical');
    expect(insights.workflowConclusion).toBe('unknown');
  });

  it('fails closed when a position is masked or runtime safety is omitted', () => {
    const insights = deriveDashboardInsights({
      account: { valuesMasked: false },
      positions: [
        { symbol: 'VISIBLE', marketValue: 400, unrealizedPnL: 20 },
        { symbol: 'MASKED', marketValue: 100, unrealizedPnL: 10, valuesMasked: true },
      ],
    });

    expect(insights.allocations).toEqual([]);
    expect(insights.totalMarketValue).toBe(0);
    expect(insights.unrealizedPnL).toBeNull();
    expect(insights.safetyState).toBe('unknown');
  });

  it('uses absolute market exposure when allocating short positions', () => {
    const insights = deriveDashboardInsights({
      runtime: { liveTradingEnabled: false },
      positions: [
        { symbol: 'LONG', marketValue: 600, unrealizedPnL: 10 },
        { symbol: 'SHORT', marketValue: -400, unrealizedPnL: 15 },
      ],
    });

    expect(insights.totalMarketValue).toBe(1000);
    expect(insights.allocations).toEqual([
      { symbol: 'LONG', marketValue: 600, share: 0.6 },
      { symbol: 'SHORT', marketValue: -400, share: 0.4 },
    ]);
  });
});
