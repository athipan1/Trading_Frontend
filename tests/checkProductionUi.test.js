// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  evaluateTelemetryContract,
  evaluateUiStatus,
} from '../scripts/check-production-ui.mjs';

const STAGE_IDS = [
  'scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution',
];
const STAGES = STAGE_IDS.map((id) => ({ id, status: 'not_attempted' }));

function decisionHistory(overrides = {}) {
  return {
    schemaVersion: 'decision-history.v1',
    retentionCycles: 24,
    cycles: [{
      flowKind: 'decision_path',
      stages: STAGES,
      candidates: [],
    }],
    ...overrides,
  };
}

function decisionAnalytics(overrides = {}) {
  return {
    schemaVersion: 'decision-analytics.v1',
    sourceHistorySchemaVersion: 'decision-history.v1',
    overallStatus: 'healthy',
    windows: [6, 12, 24].map((size) => ({
      size,
      cyclesAvailable: 1,
      funnel: STAGE_IDS.map((stage) => ({ stage, reachedCount: 0, reachRate: null })),
      topBlockingReasons: [],
    })),
    alerts: [],
    dataQuality: {
      historyCycles: 1,
      meaningfulCycles: 1,
    },
    ...overrides,
  };
}

function telemetryPayload(overrides = {}) {
  return {
    agents: [{ id: 'manager' }, { id: 'database' }],
    risk: { riskLevel: 'low' },
    backtest: { latestRun: null, history: [] },
    decisionHistory: decisionHistory(),
    decisionAnalytics: decisionAnalytics(),
    ...overrides,
  };
}

describe('Production smoke UI classification', () => {
  it('accepts a stale banner as degraded upstream data', () => {
    expect(
      evaluateUiStatus({
        errorBannerTexts: [],
        staleBannerCount: 1,
      }),
    ).toEqual({
      staleDataVisible: true,
      warnings: [
        'Production UI is healthy but displays a stale Manager snapshot warning.',
      ],
    });
  });

  it('accepts a healthy page without warnings', () => {
    expect(
      evaluateUiStatus({
        errorBannerTexts: [],
        staleBannerCount: 0,
      }),
    ).toEqual({ staleDataVisible: false, warnings: [] });
  });

  it('fails when the application reports a snapshot load error', () => {
    expect(() =>
      evaluateUiStatus({
        errorBannerTexts: ['โหลด Snapshot ไม่สำเร็จ'],
        staleBannerCount: 1,
      }),
    ).toThrow('data-load error');
  });
});

describe('Production telemetry, history, and analytics contract', () => {
  it('accepts published telemetry, bounded history, and decision analytics without inventing backtest data', () => {
    expect(evaluateTelemetryContract(telemetryPayload())).toEqual({
      agentTelemetryCount: 2,
      riskTelemetryAvailable: true,
      backtestTelemetryAvailable: false,
      decisionHistoryCycleCount: 1,
      decisionAnalyticsStatus: 'healthy',
      decisionAnalyticsAlertCount: 0,
      decisionAnalyticsMeaningfulCycles: 1,
    });
  });

  it('reports backtest telemetry and analytics alerts when present', () => {
    expect(
      evaluateTelemetryContract(telemetryPayload({
        agents: [],
        risk: null,
        backtest: {
          latestRun: { id: 'bt-1' },
          history: [],
        },
        decisionAnalytics: decisionAnalytics({
          overallStatus: 'warning',
          alerts: [{ code: 'snapshot_stale', severity: 'warning' }],
        }),
      })),
    ).toMatchObject({
      backtestTelemetryAvailable: true,
      decisionHistoryCycleCount: 1,
      decisionAnalyticsStatus: 'warning',
      decisionAnalyticsAlertCount: 1,
    });
  });

  it.each([
    [{ risk: null, backtest: { latestRun: null, history: [] }, decisionHistory: decisionHistory(), decisionAnalytics: decisionAnalytics() }, 'agents projection'],
    [{ agents: [], backtest: { latestRun: null, history: [] }, decisionHistory: decisionHistory(), decisionAnalytics: decisionAnalytics() }, 'risk projection'],
    [{ agents: [], risk: null, decisionHistory: decisionHistory(), decisionAnalytics: decisionAnalytics() }, 'backtest projection'],
    [{ agents: [], risk: null, backtest: { latestRun: null }, decisionHistory: decisionHistory(), decisionAnalytics: decisionAnalytics() }, 'backtest projection is malformed'],
  ])('fails closed when a required telemetry projection regresses', (payload, message) => {
    expect(() => evaluateTelemetryContract(payload)).toThrow(message);
  });

  it.each([
    [telemetryPayload({ decisionHistory: null }), 'decisionHistory projection'],
    [telemetryPayload({ decisionHistory: decisionHistory({ schemaVersion: 'decision-history.v0' }) }), 'schema must be decision-history.v1'],
    [telemetryPayload({ decisionHistory: decisionHistory({ retentionCycles: 12 }) }), 'retention must be 24'],
    [telemetryPayload({ decisionHistory: decisionHistory({ cycles: [] }) }), '1-24 cycles'],
    [telemetryPayload({ decisionHistory: decisionHistory({ cycles: Array.from({ length: 25 }, () => ({ stages: STAGES, candidates: [] })) }) }), '1-24 cycles'],
    [telemetryPayload({ decisionHistory: decisionHistory({ cycles: [{ stages: STAGES.slice(0, 6), candidates: [] }] }) }), 'exactly 7 stages'],
    [telemetryPayload({ decisionHistory: decisionHistory({ cycles: [{ stages: STAGES, candidates: Array.from({ length: 11 }, () => ({})) }] }) }), 'invalid candidate count'],
  ])('fails closed when Phase 17 history regresses', (payload, message) => {
    expect(() => evaluateTelemetryContract(payload)).toThrow(message);
  });

  it.each([
    [telemetryPayload({ decisionAnalytics: null }), 'decisionAnalytics projection'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ schemaVersion: 'decision-analytics.v0' }) }), 'schema must be decision-analytics.v1'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ sourceHistorySchemaVersion: 'decision-history.v0' }) }), 'source history schema'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ overallStatus: 'panic' }) }), 'overallStatus'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ windows: [] }) }), '6/12/24 windows'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ windows: [
      { size: 5, funnel: STAGE_IDS.map((stage) => ({ stage })), topBlockingReasons: [] },
      ...decisionAnalytics().windows.slice(1),
    ] }) }), 'window 0'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ windows: [
      { ...decisionAnalytics().windows[0], funnel: decisionAnalytics().windows[0].funnel.slice(0, 6) },
      ...decisionAnalytics().windows.slice(1),
    ] }) }), 'funnel'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ alerts: [{ code: 'x', severity: 'panic' }] }) }), 'alerts'],
    [telemetryPayload({ decisionAnalytics: decisionAnalytics({ dataQuality: { historyCycles: 2, meaningfulCycles: 1 } }) }), 'data quality'],
  ])('fails closed when Phase 18 analytics regresses', (payload, message) => {
    expect(() => evaluateTelemetryContract(payload)).toThrow(message);
  });
});
