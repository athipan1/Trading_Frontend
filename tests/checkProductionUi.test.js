// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  evaluateTelemetryContract,
  evaluateUiStatus,
} from '../scripts/check-production-ui.mjs';

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

describe('Phase 12 production telemetry contract', () => {
  it('accepts published agent/risk/backtest projections without inventing backtest data', () => {
    expect(
      evaluateTelemetryContract({
        agents: [{ id: 'manager' }, { id: 'database' }],
        risk: { riskLevel: 'low' },
        backtest: { latestRun: null, history: [] },
      }),
    ).toEqual({
      agentTelemetryCount: 2,
      riskTelemetryAvailable: true,
      backtestTelemetryAvailable: false,
    });
  });

  it('reports backtest telemetry when a latest run or history exists', () => {
    expect(
      evaluateTelemetryContract({
        agents: [],
        risk: null,
        backtest: {
          latestRun: { id: 'bt-1' },
          history: [],
        },
      }),
    ).toMatchObject({ backtestTelemetryAvailable: true });
  });

  it.each([
    [{ risk: null, backtest: { latestRun: null, history: [] } }, 'agents projection'],
    [{ agents: [], backtest: { latestRun: null, history: [] } }, 'risk projection'],
    [{ agents: [], risk: null }, 'backtest projection'],
    [{ agents: [], risk: null, backtest: { latestRun: null } }, 'backtest projection is malformed'],
  ])('fails closed when a required Phase 12 projection regresses', (payload, message) => {
    expect(() => evaluateTelemetryContract(payload)).toThrow(message);
  });
});
