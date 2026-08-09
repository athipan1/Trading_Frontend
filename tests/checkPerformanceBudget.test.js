// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { evaluateBundleBudget, formatBundleSummary } from '../scripts/check-performance-budget.mjs';

describe('Phase 14 bundle performance budgets', () => {
  it('passes metrics that are at or below every configured limit', () => {
    const metrics = {
      entryJsRawBytes: 100,
      entryJsGzipBytes: 50,
      totalJsGzipBytes: 80,
      totalCssRawBytes: 40,
      totalCssGzipBytes: 20,
      totalDistGzipBytes: 120,
      assetCount: 5,
      jsAssetCount: 3,
    };
    const evaluation = evaluateBundleBudget(metrics, { ...metrics });
    expect(evaluation.pass).toBe(true);
    expect(evaluation.failures).toEqual([]);
  });

  it('reports every regression instead of stopping at the first exceeded budget', () => {
    const evaluation = evaluateBundleBudget(
      { entryJsGzipBytes: 110, totalJsGzipBytes: 150, assetCount: 30 },
      { entryJsGzipBytes: 100, totalJsGzipBytes: 140, assetCount: 26 },
    );
    expect(evaluation.pass).toBe(false);
    expect(evaluation.failures.map((failure) => failure.metric)).toEqual([
      'entryJsGzipBytes',
      'totalJsGzipBytes',
      'assetCount',
    ]);
  });

  it('fails closed when a required metric is missing', () => {
    const evaluation = evaluateBundleBudget({}, { totalDistGzipBytes: 100 });
    expect(evaluation.pass).toBe(false);
    expect(evaluation.failures[0]).toMatchObject({
      metric: 'totalDistGzipBytes',
      reason: 'metric missing or non-finite',
    });
  });

  it('formats a human-readable summary for CI logs', () => {
    expect(formatBundleSummary({
      metrics: {
        entryJsRawBytes: 1024,
        entryJsGzipBytes: 512,
        totalJsGzipBytes: 2048,
        totalCssRawBytes: 1024,
        totalCssGzipBytes: 512,
        totalDistGzipBytes: 4096,
        assetCount: 8,
        jsAssetCount: 4,
      },
    })).toContain('entry JS: 1.00 KiB raw / 0.50 KiB gzip');
  });
});
