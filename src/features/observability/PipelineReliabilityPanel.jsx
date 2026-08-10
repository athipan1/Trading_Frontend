import { Activity, ShieldCheck, TriangleAlert } from 'lucide-react';
import { derivePipelineReliability } from './pipelineReliability.js';

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
          <span>Decision cycles</span>
          <strong data-testid="pipeline-decision-cycles">{reliability.decisionCycles}</strong>
        </div>
        <div>
          <span>Control cycles</span>
          <strong data-testid="pipeline-control-cycles">{reliability.controlCycles}</strong>
        </div>
        <div>
          <span>{language === 'th' ? 'Artifact gaps จริง' : 'True artifact gaps'}</span>
          <strong data-testid="pipeline-metadata-gaps">{reliability.metadataGaps}</strong>
        </div>
        <div>
          <span>Artifact coverage</span>
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
