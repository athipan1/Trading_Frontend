import { describe, expect, it } from 'vitest';
import { derivePipelineReliability } from './PipelineReliabilityPanel.jsx';

function cycle(source, reasonCode = null) {
  return { source, reasonCode, stages: [], candidates: [] };
}

describe('derivePipelineReliability', () => {
  it('separates decisions, intentional controls, and true metadata gaps', () => {
    const result = derivePipelineReliability({
      cycles: [
        cycle('hourly_artifact', 'hourly_schedule_disabled'),
        cycle('workflow_metadata', 'scheduled_paper_cycle_not_authorized'),
        cycle('workflow_metadata', 'hourly_artifact_unavailable'),
        cycle('hourly_artifact', 'no_preselected_backtest_symbols'),
      ],
    });

    expect(result).toMatchObject({
      historyCycles: 4,
      decisionCycles: 1,
      controlCycles: 2,
      metadataGaps: 1,
      artifactBackedCycles: 2,
      artifactCoverageRate: 0.5,
      latestCycleClass: 'control',
      latestCycleSource: 'hourly_artifact',
      latestReasonCode: 'hourly_schedule_disabled',
    });
  });

  it('keeps real missing artifacts visible', () => {
    const result = derivePipelineReliability({
      cycles: [cycle('workflow_metadata', 'hourly_artifact_unavailable')],
    });
    expect(result.metadataGaps).toBe(1);
    expect(result.controlCycles).toBe(0);
    expect(result.latestCycleClass).toBe('metadata_gap');
    expect(result.artifactCoverageRate).toBe(0);
  });

  it('handles empty history without inventing coverage', () => {
    expect(derivePipelineReliability({ cycles: [] })).toMatchObject({
      historyCycles: 0,
      decisionCycles: 0,
      controlCycles: 0,
      metadataGaps: 0,
      artifactBackedCycles: 0,
      artifactCoverageRate: null,
      latestCycleClass: 'unknown',
    });
  });
});
