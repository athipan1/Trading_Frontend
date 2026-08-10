import { Activity, ShieldCheck, TriangleAlert } from 'lucide-react';

const CONTROL_REASONS = new Set([
  'hourly_schedule_disabled',
  'scheduled_paper_cycle_not_authorized',
]);

function classifyCycle(cycle) {
  const reason = cycle?.reasonCode || null;
  if (CONTROL_REASONS.has(reason)) return 'control';
  if (cycle?.source === 'workflow_metadata') return 'metadata_gap';
  return 'decision';
}

export function derivePipelineReliability(history) {
  const cycles = Array.isArray(history?.cycles) ? history.cycles : [];
  const counts = { decision: 0, control: 0, metadata_gap: 0, artifactBacked: 0 };
  for (const cycle of cycles) {
    const kind = classifyCycle(cycle);
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
    latestCycleClass: cycles.length ? classifyCycle(cycles[0]) : 'unknown',
    latestCycleSource: cycles[0]?.source || 'unknown',
    latestReasonCode: cycles[0]?.reasonCode || null,
  };
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
}

const CLASS_LABELS = {
  decision: ['Decision', 'Decision'],
  control: ['Control', 'Control'],
  metadata_gap: ['ข้อมูลขาด', 'Metadata gap'],
  unknown: ['ไม่ทราบ', 'Unknown'],
};

function localized(row, language) {
  return row?.[language === 'th' ? 0 : 1] || '—';
}

export default function PipelineReliabilityPanel({ history, language = 'th' }) {
  const reliability = derivePipelineReliability(history);
  const hasGap = reliability.metadataGaps > 0;

  return (
    <section
      className="panel decision-history-panel"
      aria-labelledby="pipeline-reliability-title"
      data-testid="pipeline-reliability"
    >
      <div className="observability-heading history-heading">
        <div>
          <p className="eyebrow"><Activity aria-hidden="true" /> Phase 19</p>
          <h2 id="pipeline-reliability-title">Hourly Pipeline Reliability</h2>
          <p>
            {language === 'th'
              ? 'แยกรอบตัดสินใจ รอบควบคุมที่ตั้งใจไม่เทรด และ artifact gap จริง โดยไม่เปลี่ยน trading decision ใน Frontend'
              : 'Separates decision cycles, intentional control cycles, and true artifact gaps without creating trading decisions in the Frontend.'}
          </p>
        </div>
        <div className="history-retention">
          <span>{language === 'th' ? 'รอบล่าสุด' : 'Latest cycle'}</span>
          <strong data-testid="pipeline-latest-class">
            {localized(CLASS_LABELS[reliability.latestCycleClass], language)}
          </strong>
        </div>
      </div>

      <div className="observability-facts" data-testid="pipeline-reliability-summary">
        <div>
          <span>{language === 'th' ? 'Decision cycles' : 'Decision cycles'}</span>
          <strong data-testid="pipeline-decision-cycles">{reliability.decisionCycles}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Control cycles' : 'Control cycles'}</span>
          <strong data-testid="pipeline-control-cycles">{reliability.controlCycles}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Artifact gaps จริง' : 'True artifact gaps'}</span>
          <strong data-testid="pipeline-metadata-gaps">{reliability.metadataGaps}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Artifact coverage' : 'Artifact coverage'}</span>
          <strong data-testid="pipeline-artifact-coverage">{percent(reliability.artifactCoverageRate)}</strong>
        </div>
      </div>

      <div className="observability-context-note" role="status" data-testid="pipeline-reliability-status">
        {hasGap ? <TriangleAlert aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        <div>
          <strong>
            {hasGap
              ? (language === 'th' ? 'ยังพบ artifact gap จริงใน history' : 'True artifact gaps remain in history')
              : (language === 'th' ? 'ไม่พบ artifact gap จริงใน history ปัจจุบัน' : 'No true artifact gaps in current history')}
          </strong>
          <span>
            {reliability.artifactBackedCycles}/{reliability.historyCycles} artifact-backed · {reliability.latestCycleSource}
            {reliability.latestReasonCode ? ` · ${reliability.latestReasonCode}` : ''}
          </span>
        </div>
      </div>
    </section>
  );
}
