// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  evaluateTelemetryContract,
  evaluateUiStatus,
} from '../scripts/check-production-ui.mjs';

const STAGES = [
  'scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution',
].map((id) => ({ id, status: 'not_attempted' }));

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

function telemetryPayload(overrides = {}) {
  return {
    agents: [{ id: 'manager' }, { id: 'database' }],
    risk: { riskLevel: 'low' },
    backtest: { latestRun: null, history: [] },
    decisionHistory: decisionHistory(),
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

describe('Production telemetry and Phase 17 history contract', () => {
  it('accepts published telemetry and bounded decision history without inventing backtest data', () => {
    expect(evaluateTelemetryContract(telemetryPayload())).toEqual({
      agentTelemetryCount: 2,
      riskTelemetryAvailable: true,
      backtestTelemetryAvailable: false,
      decisionHistoryCycleCount: 1,
    });
  });

  it('reports backtest telemetry when a latest run or history exists', () => {
    expect(
      evaluateTelemetryContract(telemetryPayload({
        agents: [],
        risk: null,
        backtest: {
          latestRun: { id: 'bt-1' },
          history: [],
        },
      })),
    ).toMatchObject({ backtestTelemetryAvailable: true, decisionHistoryCycleCount: 1 });
  });

  it.each([
    [{ risk: null, backtest: { latestRun: null, history: [] }, decisionHistory: decisionHistory() }, 'agents projection'],
    [{ agents: [], backtest: { latestRun: null, history: [] }, decisionHistory: decisionHistory() }, 'risk projection'],
    [{ agents: [], risk: null, decisionHistory: decisionHistory() }, 'backtest projection'],
    [{ agents: [], risk: null, backtest: { latestRun: null }, decisionHistory: decisionHistory() }, 'backtest projection is malformed'],
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
});
