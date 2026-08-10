// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveReliability } from '../scripts/check-production-pipeline-reliability.mjs';

function cycle(source, reasonCode = null) {
  return { source, reasonCode };
}

function payload(cycles, quality = {}) {
  const derived = {
    historyCycles: cycles.length,
    meaningfulCycles: cycles.filter((row) => row.source === 'hourly_artifact' && !['hourly_schedule_disabled', 'scheduled_paper_cycle_not_authorized'].includes(row.reasonCode)).length,
    controlCycles: cycles.filter((row) => ['hourly_schedule_disabled', 'scheduled_paper_cycle_not_authorized'].includes(row.reasonCode)).length,
    metadataOnlyCycles: cycles.filter((row) => row.source === 'workflow_metadata' && !['hourly_schedule_disabled', 'scheduled_paper_cycle_not_authorized'].includes(row.reasonCode)).length,
    artifactBackedCycles: cycles.filter((row) => row.source === 'hourly_artifact').length,
  };
  derived.artifactCoverageRate = derived.artifactBackedCycles / cycles.length;
  const latest = ['hourly_schedule_disabled', 'scheduled_paper_cycle_not_authorized'].includes(cycles[0]?.reasonCode)
    ? 'control'
    : cycles[0]?.source === 'workflow_metadata' ? 'metadata_gap' : 'decision';
  return {
    decisionHistory: { schemaVersion: 'decision-history.v1', retentionCycles: 24, cycles },
    decisionAnalytics: {
      schemaVersion: 'decision-analytics.v1',
      dataQuality: { ...derived, latestCycleClass: latest, ...quality },
    },
  };
}

describe('Phase 19 production reliability contract', () => {
  it('accepts Manager counts that match bounded history', () => {
    const result = deriveReliability(payload([
      cycle('hourly_artifact', 'no_preselected_backtest_symbols'),
      cycle('workflow_metadata', 'scheduled_paper_cycle_not_authorized'),
      cycle('workflow_metadata', 'hourly_artifact_unavailable'),
    ]));
    expect(result).toMatchObject({
      historyCycles: 3,
      decisionCycles: 1,
      controlCycles: 1,
      metadataGaps: 1,
      artifactBackedCycles: 1,
      latestCycleClass: 'decision',
    });
    expect(result.artifactCoverageRate).toBeCloseTo(1 / 3);
  });

  it('fails closed when Manager dataQuality does not match history', () => {
    expect(() => deriveReliability(payload([
      cycle('hourly_artifact', 'no_preselected_backtest_symbols'),
      cycle('workflow_metadata', 'hourly_artifact_unavailable'),
    ], { metadataOnlyCycles: 0 }))).toThrow('metadataOnlyCycles mismatch');
  });

  it('fails closed when Phase 19 fields are missing', () => {
    const value = payload([cycle('hourly_artifact', 'no_preselected_backtest_symbols')]);
    delete value.decisionAnalytics.dataQuality.controlCycles;
    expect(() => deriveReliability(value)).toThrow('controlCycles mismatch');
  });
});
