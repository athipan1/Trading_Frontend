import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

function StatusIcon({ status }) {
  if (status === 'success' || status === 'completed') return <CheckCircle2 aria-hidden="true" />;
  if (status === 'running') return <RefreshCw aria-hidden="true" />;
  if (status === 'pending') return <Clock3 aria-hidden="true" />;
  if (status === 'warning') return <TriangleAlert aria-hidden="true" />;
  if (status === 'failure') return <XCircle aria-hidden="true" />;
  if (status === 'cancelled' || status === 'skipped') return <Ban aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

const COPY = {
  th: {
    title: 'สถานะระบบเทรดรายชั่วโมง', latestRun: 'รอบล่าสุด', runNumber: 'Run', trigger: 'รูปแบบการรัน', runtime: 'โหมดระบบ', workflow: 'Workflow', cycle: 'รอบการทำงาน', execution: 'การส่งคำสั่ง', attempted: 'มีการพยายามส่งคำสั่ง', notAttempted: 'ไม่ได้ส่งคำสั่ง', reason: 'เหตุผล', candidates: 'Candidate', positions: 'Position', orders: 'Open order', lastSuccess: 'รอบสำเร็จล่าสุด', snapshotAge: 'อายุ Snapshot', minutes: 'นาที', stale: 'ข้อมูลเก่าเกินกำหนด', staleDetail: 'Snapshot อาจไม่สะท้อนรอบล่าสุด กรุณาตรวจ GitHub Actions', masked: 'ข้อมูลการเงินถูกปกปิด', openRun: 'เปิด GitHub Actions run', phases: 'ลำดับการทำงาน', refresh: 'รีเฟรชตอนนี้', scheduled: 'ตามเวลา', manual: 'สั่งรันเอง', noData: 'ยังไม่มีข้อมูลรอบการทำงาน', loading: 'กำลังโหลดสถานะรายชั่วโมง', partialFill: 'พบ Partial fill', absolute: 'เวลาไทย', relativeNow: 'เมื่อสักครู่', safe: 'Paper-only',
  },
  en: {
    title: 'Hourly Automation Status', latestRun: 'Latest run', runNumber: 'Run', trigger: 'Trigger', runtime: 'Runtime', workflow: 'Workflow', cycle: 'Cycle', execution: 'Execution', attempted: 'Execution attempted', notAttempted: 'Not attempted', reason: 'Reason', candidates: 'Candidates', positions: 'Positions', orders: 'Open orders', lastSuccess: 'Last successful run', snapshotAge: 'Snapshot age', minutes: 'minutes', stale: 'Stale data', staleDetail: 'The snapshot may not reflect the latest run. Check GitHub Actions.', masked: 'Financial values are masked', openRun: 'Open GitHub Actions run', phases: 'Execution phases', refresh: 'Refresh now', scheduled: 'Scheduled', manual: 'Manual', noData: 'No hourly run data is available yet', loading: 'Loading hourly automation status', partialFill: 'Partial fill detected', absolute: 'Bangkok time', relativeNow: 'just now', safe: 'Paper-only',
  },
};

const PHASE_LABELS = {
  preflight: ['Preflight', 'Preflight'],
  portfolio_review: ['ตรวจพอร์ต', 'Portfolio Review'],
  protection_reconciliation: ['ตรวจ TP/SL', 'Protection Reconciliation'],
  scanner: ['Scanner', 'Scanner'],
  backtest: ['Backtest', 'Backtest'],
  risk: ['Risk', 'Risk'],
  execution: ['Execution', 'Execution'],
  final_reconciliation: ['ตรวจสอบหลังรัน', 'Final Reconciliation'],
};

function statusLabel(status) {
  return String(status || 'unknown').replaceAll('_', ' ');
}

function formatAbsolute(value, language) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'medium',
  }).format(new Date(value));
}

function formatRelative(value, language, copy) {
  if (!value) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return copy.relativeNow;
  const formatter = new Intl.RelativeTimeFormat(language === 'th' ? 'th' : 'en', { numeric: 'always' });
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  return formatter.format(-Math.round(hours / 24), 'day');
}

function validRunUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

function StatusValue({ label, status }) {
  return (
    <div className="automation-stat">
      <span>{label}</span>
      <strong className={`automation-status status-${status || 'unknown'}`}>
        <StatusIcon status={status} /> {statusLabel(status)}
      </strong>
    </div>
  );
}

export default function HourlyAutomationStatus({ snapshot, language = 'th', isLoading, isRefreshing, onRefresh }) {
  const copy = COPY[language] || COPY.en;
  if (isLoading && !snapshot?.generatedAt) {
    return (
      <section className="panel automation-panel automation-skeleton" aria-busy="true" aria-label={copy.loading}>
        <div className="skeleton-line skeleton-title" />
        <div className="automation-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div>
      </section>
    );
  }

  const workflow = snapshot?.workflow || {};
  const runtime = snapshot?.runtime || {};
  const cycle = snapshot?.cycle || {};
  const freshness = snapshot?.freshness || {};
  const summary = snapshot?.summary || {};
  const privacy = snapshot?.privacy || {};
  const runUrl = validRunUrl(workflow.runUrl);
  const trigger = workflow.eventName === 'schedule' ? copy.scheduled : copy.manual;
  const generatedAt = snapshot?.generatedAt;

  return (
    <section className="panel automation-panel" aria-labelledby="hourly-automation-title" data-testid="hourly-automation-status">
      {freshness.isStale ? (
        <div className="stale-banner" role="alert">
          <TriangleAlert aria-hidden="true" />
          <div><strong>{copy.stale}</strong><span>{copy.staleDetail}</span></div>
        </div>
      ) : null}
      {snapshot?.error ? (
        <div className="workflow-error" role="status">
          <XCircle aria-hidden="true" /><span>{snapshot.error.message}</span>
        </div>
      ) : null}
      <div className="section-heading automation-heading">
        <div>
          <p className="eyebrow">GitHub Actions snapshot</p>
          <h2 id="hourly-automation-title">{copy.title}</h2>
        </div>
        <div className="automation-actions">
          <span className="status good"><ShieldCheck aria-hidden="true" /> {copy.safe}</span>
          <button className="icon-action" type="button" onClick={() => onRefresh?.()} disabled={isRefreshing} aria-label={copy.refresh}>
            <RefreshCw className={isRefreshing ? 'spinning' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="automation-grid">
        <div className="automation-stat">
          <span>{copy.latestRun}</span>
          <strong>{formatAbsolute(generatedAt, language)}</strong>
          <small>{formatRelative(generatedAt, language, copy)} · {copy.absolute}</small>
        </div>
        <div className="automation-stat"><span>{copy.trigger}</span><strong>{trigger}</strong><small>{copy.runNumber} #{workflow.runNumber ?? '—'}</small></div>
        <div className="automation-stat"><span>{copy.runtime}</span><strong>{runtime.mode || 'UNKNOWN'}</strong><small>{runtime.brokerMode || 'UNKNOWN'}</small></div>
        <StatusValue label={copy.workflow} status={workflow.conclusion} />
        <StatusValue label={copy.cycle} status={cycle.status} />
        <div className="automation-stat">
          <span>{copy.execution}</span>
          <strong>{cycle.executionAttempted ? copy.attempted : copy.notAttempted}</strong>
          <small>{statusLabel(cycle.executionStatus)}</small>
        </div>
        <div className="automation-stat"><span>{copy.candidates}</span><strong>{summary.candidateCount ?? cycle.candidateCount ?? 0}</strong><small>{copy.positions}: {summary.positionCount ?? 0}</small></div>
        <div className="automation-stat"><span>{copy.orders}</span><strong>{summary.openOrderCount ?? 0}</strong><small>{cycle.partialFillDetected ? copy.partialFill : '—'}</small></div>
        <div className="automation-stat"><span>{copy.snapshotAge}</span><strong>{freshness.ageMinutes == null ? '—' : Math.round(freshness.ageMinutes)}</strong><small>{copy.minutes}</small></div>
      </div>

      {cycle.executionReason ? <p className="automation-reason"><strong>{copy.reason}:</strong> {cycle.executionReason}</p> : null}

      <div className="automation-meta-row">
        <span><strong>{copy.lastSuccess}:</strong> {formatAbsolute(snapshot?.lastSuccessfulRun?.generatedAt, language)}</span>
        {privacy.valuesMasked ? <span className="masked-indicator"><ShieldCheck aria-hidden="true" /> {copy.masked}</span> : null}
        {runUrl ? <a className="run-link" href={runUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> {copy.openRun}</a> : null}
      </div>

      <div className="phase-section">
        <h3>{copy.phases}</h3>
        {snapshot?.phases?.length ? (
          <ol className="phase-timeline">
            {snapshot.phases.map((item, index) => {
              const labels = PHASE_LABELS[item.name] || [item.name, item.name];
              return (
                <li key={`${item.name}-${index}`} className={`phase-item status-${item.status}`}>
                  <StatusIcon status={item.status} />
                  <div><strong>{labels[language === 'th' ? 0 : 1]}</strong><span>{statusLabel(item.status)}{item.message ? ` · ${item.message}` : ''}</span></div>
                </li>
              );
            })}
          </ol>
        ) : <p className="hint">{copy.noData}</p>}
      </div>
    </section>
  );
}
