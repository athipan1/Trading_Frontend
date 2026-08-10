const CONTROL_REASONS = new Set([
  'hourly_schedule_disabled',
  'scheduled_paper_cycle_not_authorized',
]);

export function classifyPipelineCycle(cycle) {
  const reason = cycle?.reasonCode || null;
  if (CONTROL_REASONS.has(reason)) return 'control';
  if (cycle?.source === 'workflow_metadata') return 'metadata_gap';
  return 'decision';
}

export function derivePipelineReliability(history) {
  const cycles = Array.isArray(history?.cycles) ? history.cycles : [];
  const counts = { decision: 0, control: 0, metadata_gap: 0, artifactBacked: 0 };
  for (const cycle of cycles) {
    const kind = classifyPipelineCycle(cycle);
    counts[kind] += 1;
    if (cycle?.source === 'hourly_artifact') counts.artifactBacked += 1;
  }
  return {
    historyCycles: cycles.length,
    decisionCycles: counts.decision,
    controlCycles: counts.control,
    metadataGaps: counts.metadata_gap,
    artifactBackedCycles: counts.artifactBacked,
    artifactCoverageRate: cycles.length ? counts.artifactBacked / cycles.length : null,
    latestCycleClass: cycles.length ? classifyPipelineCycle(cycles[0]) : 'unknown',
    latestCycleSource: cycles[0]?.source || 'unknown',
    latestReasonCode: cycles[0]?.reasonCode || null,
  };
}
