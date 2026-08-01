import { describe, expect, it } from 'vitest';
import { deriveRiskDashboard } from './riskDashboardModel.js';

describe('risk dashboard model', () => {
  it('prefers bounded Manager-published risk metrics and guardrails', () => {
    const risk = deriveRiskDashboard({
      account: { equity: 100_000, valuesMasked: false },
      privacy: { valuesMasked: false },
      positions: [{ marketValue: 10_000, sector: 'Utilities', protection: { hasBracket: true } }],
      risk: {
        riskLevel: 'medium',
        riskScore: 44,
        grossExposurePercent: 35,
        netExposurePercent: 18,
        drawdownPercent: 3,
        sectorAllocation: [{ sector: 'Technology', percent: 70, marketValue: 7000 }],
        limits: { grossExposurePercent: 50, drawdownPercent: 10 },
        emergencyHalt: { active: false, reason: 'Normal', updatedAt: '2026-07-30T00:00:00Z' },
      },
      phases: [{ name: 'risk', status: 'success', message: 'Approved' }],
    });

    expect(risk).toMatchObject({
      riskTelemetryPublished: true,
      riskLevel: 'moderate',
      riskScore: 44,
      grossExposurePercent: 35,
      exposureSource: 'manager',
      drawdownPercent: 3,
      sectorSource: 'manager',
      emergencyHalt: { published: true, active: false },
      limits: { grossUtilization: 70, drawdownUtilization: 30 },
      riskPhase: { status: 'success' },
    });
    expect(risk.sectorAllocation[0]).toMatchObject({ sector: 'Technology', percent: 70 });
  });

  it('calculates exposure and sectors from visible positions without inventing drawdown or level', () => {
    const risk = deriveRiskDashboard({
      account: { equity: 50_000, valuesMasked: false },
      privacy: { valuesMasked: false },
      positions: [
        { marketValue: 10_000, sector: 'Technology', protection: { hasBracket: true } },
        { marketValue: -5_000, sector: 'Financials', protection: { hasStopLoss: true, hasTakeProfit: false } },
      ],
      phases: [],
    });

    expect(risk).toMatchObject({
      riskTelemetryPublished: false,
      grossExposureValue: 15_000,
      netExposureValue: 5_000,
      grossExposurePercent: 30,
      netExposurePercent: 10,
      exposureSource: 'calculated',
      drawdownPercent: null,
      riskLevel: 'unavailable',
      sectorSource: 'positions',
      protection: { protectedCount: 1, totalCount: 2, percent: 50 },
      emergencyHalt: { published: false, active: null },
    });
    expect(risk.sectorAllocation.map((item) => item.sector)).toEqual(['Technology', 'Financials']);
    expect(risk.sectorAllocation[0].percent).toBeCloseTo(66.67, 2);
    expect(risk.sectorAllocation[1].percent).toBeCloseTo(33.33, 2);
  });

  it('keeps financial metrics unavailable when Manager masks values', () => {
    const risk = deriveRiskDashboard({
      account: { equity: null, valuesMasked: true },
      privacy: { valuesMasked: true },
      positions: [{ marketValue: 10_000, sector: 'Technology', valuesMasked: true, protection: {} }],
      risk: null,
    });
    expect(risk).toMatchObject({
      valuesMasked: true,
      grossExposureValue: null,
      netExposureValue: null,
      grossExposurePercent: null,
      sectorAllocation: [],
      sectorSource: 'unavailable',
    });
  });

  it('treats an active Manager emergency halt as critical without deriving a control response', () => {
    const risk = deriveRiskDashboard({
      positions: [],
      risk: {
        riskLevel: 'low',
        emergencyHalt: { active: true, reason: 'Manual stop' },
        sectorAllocation: [{ sector: 'Energy', marketValue: 200 }, { sector: 'Cash', marketValue: 800 }],
      },
    });
    expect(risk.riskLevel).toBe('critical');
    expect(risk.emergencyHalt).toMatchObject({ published: true, active: true, reason: 'Manual stop' });
    expect(risk.sectorAllocation.map((item) => item.percent)).toEqual([80, 20]);
  });
});
