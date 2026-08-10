import { describe, expect, it } from 'vitest';
import {
  DECISION_ANALYTICS_SCHEMA_VERSION,
  DECISION_HISTORY_SCHEMA_VERSION,
  OBSERVABILITY_STAGE_ORDER,
  normalizeDecisionAnalytics,
  normalizeDecisionHistory,
  normalizeTradingObservability,
} from './observabilityApi.js';

function cycle(overrides = {}) {
  return {
    source: 'hourly_artifact',
    flowKind: 'decision_path',
    correlationId: 'corr-1',
    cycleId: 'cycle-1',
    workflowRunId: 123,
    observedAt: '2026-08-09T11:48:23Z',
    status: 'controlled_no_trade',
    reasonCode: 'no_preselected_backtest_symbols',
    stages: OBSERVABILITY_STAGE_ORDER.map((id) => ({
      id,
      status: id === 'scanner' ? 'success' : 'not_attempted',
      reasonCodes: [],
      observedAt: '2026-08-09T11:48:23Z',
      summary: {},
    })),
    candidates: [{
      symbol: 'BANX',
      rank: 1,
      verdict: 'buy',
      finalScore: 0.638,
      strategyBucket: 'value_rebound',
      status: 'blocked',
      stageReached: 'scanner',
      reasonCodes: [
        'investability_market_cap_below_minimum',
        'investability_average_dollar_volume_below_minimum',
      ],
    }],
    ...overrides,
  };
}

function historyCycle(overrides = {}) {
  const base = cycle(overrides);
  return {
    ...base,
    summary: {
      candidateCount: base.candidates.length,
      buyCount: 1,
      blockedCount: 1,
      executedCount: 0,
      riskRejectedCount: 0,
      executionFailureCount: 0,
    },
    candidates: base.candidates.map((candidate) => ({
      ...candidate,
      refs: { decisionId: 'decision-1', positionId: 'position-1' },
    })),
  };
}

function analyticsWindow(size, overrides = {}) {
  return {
    size,
    cyclesAvailable: Math.min(2, size),
    metrics: {
      candidateCount: 4,
      buyCount: 2,
      blockedCount: 2,
      executedCount: 1,
      riskRejectedCount: 1,
      executionFailureCount: 0,
    },
    rates: {
      buyRate: 0.5,
      blockedRate: 0.5,
      executionRate: 0.25,
      riskRejectionRate: 0.5,
      executionFailureRate: 0,
    },
    funnel: OBSERVABILITY_STAGE_ORDER.map((stage, index) => ({
      stage,
      reachedCount: index === 0 ? 4 : index < 6 ? 2 : 1,
      reachRate: index === 0 ? 1 : index < 6 ? 0.5 : 0.25,
    })),
    topBlockingReasons: [{
      code: 'investability_market_cap_below_minimum',
      count: 1,
      shareOfBlockedCandidates: 0.5,
    }],
    ...overrides,
  };
}

function analyticsPayload(overrides = {}) {
  return {
    schemaVersion: DECISION_ANALYTICS_SCHEMA_VERSION,
    generatedAt: '2026-08-09T12:00:00Z',
    sourceHistorySchemaVersion: DECISION_HISTORY_SCHEMA_VERSION,
    overallStatus: 'warning',
    latest: {
      source: 'workflow_metadata',
      correlationId: null,
      cycleId: null,
      workflowRunId: 456,
      observedAt: '2026-08-09T12:00:00Z',
      status: 'unknown',
      reasonCode: 'hourly_artifact_unavailable',
      summary: {
        candidateCount: 0,
        buyCount: 0,
        blockedCount: 0,
        executedCount: 0,
        riskRejectedCount: 0,
        executionFailureCount: 0,
      },
    },
    latestMeaningful: {
      source: 'hourly_artifact',
      correlationId: 'corr-1',
      cycleId: 'cycle-1',
      workflowRunId: 123,
      observedAt: '2026-08-09T11:48:23Z',
      status: 'controlled_no_trade',
      reasonCode: 'no_preselected_backtest_symbols',
      summary: {
        candidateCount: 4,
        buyCount: 2,
        blockedCount: 2,
        executedCount: 1,
        riskRejectedCount: 1,
        executionFailureCount: 0,
      },
    },
    windows: [6, 12, 24].map((size) => analyticsWindow(size)),
    trend: {
      comparison: 'latest6_vs_previous6',
      enoughData: false,
      latestCycles: 2,
      previousCycles: 0,
      candidateCountDelta: null,
      blockedRateDeltaPoints: null,
      executionRateDeltaPoints: null,
      riskRejectionRateDeltaPoints: null,
    },
    alerts: [{
      code: 'hourly_artifact_unavailable',
      severity: 'warning',
      status: 'active',
      value: true,
      threshold: null,
      windowCycles: 1,
      observedAt: '2026-08-09T12:00:00Z',
    }],
    dataQuality: {
      historyCycles: 3,
      meaningfulCycles: 2,
      metadataOnlyCycles: 1,
      latestCycleSource: 'workflow_metadata',
      latestReasonCode: 'hourly_artifact_unavailable',
      latestMeaningfulObservedAt: '2026-08-09T11:48:23Z',
      sufficientFor6CycleWindow: false,
      sufficientForTrendComparison: false,
    },
    ...overrides,
  };
}

describe('trading observability contract', () => {
  it('normalizes the bounded Phase 16 projection', () => {
    const current = cycle();
    const normalized = normalizeTradingObservability({
      schemaVersion: 'trading-observability.v1',
      current,
      lastMeaningful: current,
    });

    expect(normalized.schemaVersion).toBe('trading-observability.v1');
    expect(normalized.current.correlationId).toBe('corr-1');
    expect(normalized.current.stages.map((stage) => stage.id)).toEqual(OBSERVABILITY_STAGE_ORDER);
    expect(normalized.current.candidates[0]).toMatchObject({
      symbol: 'BANX',
      status: 'blocked',
      stageReached: 'scanner',
      finalScore: 0.638,
    });
  });

  it('accepts a metadata-only current cycle with a distinct last meaningful cycle', () => {
    const metadata = cycle({
      source: 'workflow_metadata',
      correlationId: null,
      cycleId: null,
      status: 'skipped',
      reasonCode: 'scheduled_paper_cycle_not_authorized',
      candidates: [],
    });
    const normalized = normalizeTradingObservability({
      schemaVersion: 'trading-observability.v1',
      current: metadata,
      lastMeaningful: cycle(),
    });
    expect(normalized.current.source).toBe('workflow_metadata');
    expect(normalized.lastMeaningful.source).toBe('hourly_artifact');
  });

  it('fails closed on stage order, unbounded candidates, or unsupported schema', () => {
    const wrongOrder = cycle();
    wrongOrder.stages = [...wrongOrder.stages].reverse();
    expect(() => normalizeTradingObservability({
      schemaVersion: 'trading-observability.v1', current: wrongOrder, lastMeaningful: null,
    })).toThrow('stages[0].id');

    expect(() => normalizeTradingObservability({
      schemaVersion: 'trading-observability.v1',
      current: cycle({ candidates: Array.from({ length: 11 }, (_, index) => ({
        symbol: `S${index}`, rank: index + 1, status: 'eligible', stageReached: 'scanner', reasonCodes: [],
      })) }),
      lastMeaningful: null,
    })).toThrow('at most 10');

    expect(() => normalizeTradingObservability({
      schemaVersion: 'trading-observability.v999', current: cycle(), lastMeaningful: null,
    })).toThrow('Unsupported observability schema');
  });

  it('returns null when the optional projection is absent', () => {
    expect(normalizeTradingObservability(null)).toBeNull();
    expect(normalizeTradingObservability(undefined)).toBeNull();
  });
});

describe('decision history contract', () => {
  it('normalizes Phase 17 history, summaries, and safe references', () => {
    const normalized = normalizeDecisionHistory({
      schemaVersion: DECISION_HISTORY_SCHEMA_VERSION,
      generatedAt: '2026-08-09T12:00:00Z',
      retentionCycles: 24,
      cycles: [historyCycle()],
    });

    expect(normalized.schemaVersion).toBe('decision-history.v1');
    expect(normalized.cycles).toHaveLength(1);
    expect(normalized.cycles[0].summary).toEqual({
      candidateCount: 1,
      buyCount: 1,
      blockedCount: 1,
      executedCount: 0,
      riskRejectedCount: 0,
      executionFailureCount: 0,
    });
    expect(normalized.cycles[0].candidates[0].refs).toEqual({
      decisionId: 'decision-1',
      positionId: 'position-1',
    });
  });

  it('fails closed on wrong retention, too many cycles, malformed stage order, and out-of-range counts', () => {
    expect(() => normalizeDecisionHistory({
      schemaVersion: 'decision-history.v1', generatedAt: null, retentionCycles: 12, cycles: [],
    })).toThrow('retentionCycles');

    expect(() => normalizeDecisionHistory({
      schemaVersion: 'decision-history.v1', generatedAt: null, retentionCycles: 24,
      cycles: Array.from({ length: 25 }, () => historyCycle()),
    })).toThrow('at most 24');

    const wrongOrder = historyCycle();
    wrongOrder.stages = [...wrongOrder.stages].reverse();
    expect(() => normalizeDecisionHistory({
      schemaVersion: 'decision-history.v1', generatedAt: null, retentionCycles: 24, cycles: [wrongOrder],
    })).toThrow('stages[0].id');

    const badSummary = historyCycle();
    badSummary.summary.candidateCount = 11;
    expect(() => normalizeDecisionHistory({
      schemaVersion: 'decision-history.v1', generatedAt: null, retentionCycles: 24, cycles: [badSummary],
    })).toThrow('candidateCount');
  });

  it('is optional so Phase 16 snapshots remain backward compatible', () => {
    expect(normalizeDecisionHistory(null)).toBeNull();
    expect(normalizeDecisionHistory(undefined)).toBeNull();
  });
});

describe('decision analytics contract', () => {
  it('normalizes Phase 18 windows, funnel, trend, alerts, and data quality', () => {
    const normalized = normalizeDecisionAnalytics(analyticsPayload());

    expect(normalized.schemaVersion).toBe('decision-analytics.v1');
    expect(normalized.overallStatus).toBe('warning');
    expect(normalized.windows.map((window) => window.size)).toEqual([6, 12, 24]);
    expect(normalized.windows[0].funnel.map((row) => row.stage)).toEqual(OBSERVABILITY_STAGE_ORDER);
    expect(normalized.windows[0].topBlockingReasons[0]).toEqual({
      code: 'investability_market_cap_below_minimum',
      count: 1,
      shareOfBlockedCandidates: 0.5,
    });
    expect(normalized.alerts[0]).toMatchObject({
      code: 'hourly_artifact_unavailable', severity: 'warning', value: true,
    });
    expect(normalized.dataQuality).toMatchObject({
      historyCycles: 3,
      meaningfulCycles: 2,
      metadataOnlyCycles: 1,
      sufficientForTrendComparison: false,
    });
  });

  it('accepts a complete latest6 vs previous6 trend', () => {
    const payload = analyticsPayload({
      trend: {
        comparison: 'latest6_vs_previous6',
        enoughData: true,
        latestCycles: 6,
        previousCycles: 6,
        candidateCountDelta: 5,
        blockedRateDeltaPoints: -10.5,
        executionRateDeltaPoints: 4.25,
        riskRejectionRateDeltaPoints: 2,
      },
      dataQuality: {
        ...analyticsPayload().dataQuality,
        historyCycles: 12,
        meaningfulCycles: 12,
        metadataOnlyCycles: 0,
        latestCycleSource: 'hourly_artifact',
        latestReasonCode: null,
        sufficientFor6CycleWindow: true,
        sufficientForTrendComparison: true,
      },
    });
    expect(normalizeDecisionAnalytics(payload).trend).toMatchObject({
      enoughData: true,
      blockedRateDeltaPoints: -10.5,
      executionRateDeltaPoints: 4.25,
    });
  });

  it('fails closed on wrong windows, malformed funnel, unsafe rates, alerts, or status', () => {
    const wrongWindows = analyticsPayload();
    wrongWindows.windows[0].size = 5;
    expect(() => normalizeDecisionAnalytics(wrongWindows)).toThrow('windows[0].size');

    const wrongFunnel = analyticsPayload();
    wrongFunnel.windows[0].funnel = [...wrongFunnel.windows[0].funnel].reverse();
    expect(() => normalizeDecisionAnalytics(wrongFunnel)).toThrow('funnel[0].stage');

    const badRate = analyticsPayload();
    badRate.windows[0].rates.blockedRate = 1.2;
    expect(() => normalizeDecisionAnalytics(badRate)).toThrow('blockedRate');

    const badAlert = analyticsPayload();
    badAlert.alerts[0].severity = 'panic';
    expect(() => normalizeDecisionAnalytics(badAlert)).toThrow('severity');

    const badStatus = analyticsPayload({ overallStatus: 'unknown' });
    expect(() => normalizeDecisionAnalytics(badStatus)).toThrow('overallStatus');
  });

  it('is optional so Phase 17 snapshots remain backward compatible', () => {
    expect(normalizeDecisionAnalytics(null)).toBeNull();
    expect(normalizeDecisionAnalytics(undefined)).toBeNull();
  });
});
