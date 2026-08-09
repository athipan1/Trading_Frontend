import { describe, expect, it } from 'vitest';
import {
  DECISION_HISTORY_SCHEMA_VERSION,
  OBSERVABILITY_STAGE_ORDER,
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
