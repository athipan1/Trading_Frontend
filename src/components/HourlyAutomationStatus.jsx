import { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock3,
  ExternalLink,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import {
  deriveSystemIncident,
  INCIDENT_PHASE_STATUSES,
  PHASE_LABELS,
  severityLabel,
  statusLabel,
  SYSTEM_COPY,
  translatedReason,
} from './systemIncidentModel.js';

function StatusIcon({ status }) {
  if (status === 'success' || status === 'completed') return <CheckCircle2 aria-hidden="true" />;
  if (status === 'running') return <RefreshCw aria-hidden="true" />;
  if (status === 'pending') return <Clock3 aria-hidden="true" />;
  if (status === 'warning') return <TriangleAlert aria-hidden="true" />;
  if (status === 'failure') return <XCircle aria-hidden="true" />;
  if (status === 'cancelled' || status === 'skipped') return <Ban aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

function IncidentIcon({ severity }) {
  if (severity === 'critical') return <ShieldAlert aria-hidden="true" />;
  if (severity === 'warning') return <TriangleAlert aria-hidden="true" />;
  if (severity === 'normal') return <CheckCircle2 aria-hidden="true" />;
  return <Info aria-hidden="true" />;
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

function IncidentSummary({ incident, copy }) {
  const role = incident.severity === 'critical' || incident.severity === 'warning' ? 'alert' : 'status';
  return (
    <div
      className={`incident-summary incident-${incident.severity}`}
      role={role}
      aria-live={incident.severity === 'critical' ? 'assertive' : 'polite'}
      data-testid="system-incident-summary"
      data-severity={incident.severity}
    >
      <IncidentIcon severity={incident.severity} />
      <div className="incident-copy">
        <div className="incident-title-row">
          <span className="incident-severity">{severityLabel(incident.severity, copy)}</span>
          <strong>{incident.title}</strong>
        </div>
        <p>{incident.detail}</p>
        <p className="incident-action"><b>{copy.nextAction}:</b> {incident.action}</p>
      </div>
    </div>
  );
}

export default function HourlyAutomationStatus({
  snapshot,
  language = 'th',
  isLoading,
  isRefreshing,
  onRefresh,
  showRefreshAction = true,
}) {
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const copy = SYSTEM_COPY[language] || SYSTEM_COPY.en;

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
  const phases = snapshot?.phases || [];
  const incident = deriveSystemIncident(snapshot, copy);
  const incidentPhaseCount = phases.filter((phase) => INCIDENT_PHASE_STATUSES.has(phase.status)).length;
  const runUrl = validRunUrl(workflow.runUrl);
  const trigger = workflow.eventName === 'schedule' ? copy.scheduled : copy.manual;
  const generatedAt = snapshot?.generatedAt;
  const readableReason = translatedReason(cycle.executionReason, copy);

  return (
    <section className="panel automation-panel" aria-labelledby="hourly-automation-title" data-testid="hourly-automation-status">
      <div className="section-heading automation-heading">
        <div>
          <p className="eyebrow">GitHub Actions snapshot</p>
          <h2 id="hourly-automation-title">{copy.title}</h2>
        </div>
        <div className="automation-actions">
          <span className="status good"><ShieldCheck aria-hidden="true" /> {copy.safe}</span>
          {showRefreshAction ? (
            <button className="icon-action" type="button" onClick={() => onRefresh?.()} disabled={isRefreshing} aria-label={copy.refresh}>
              <RefreshCw className={isRefreshing ? 'spinning' : ''} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <IncidentSummary incident={incident} copy={copy} />

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

      {cycle.executionReason ? (
        <div className="automation-reason" data-testid="execution-reason">
          <p><strong>{copy.reason}:</strong> {readableReason}</p>
          <p><strong>{copy.rawCode}:</strong> <code>{cycle.executionReason}</code></p>
        </div>
      ) : null}

      <div className="automation-meta-row">
        <span><strong>{copy.lastSuccess}:</strong> {formatAbsolute(snapshot?.lastSuccessfulRun?.generatedAt, language)}</span>
        {privacy.valuesMasked ? <span className="masked-indicator"><ShieldCheck aria-hidden="true" /> {copy.masked}</span> : null}
        {runUrl ? <a className="run-link" href={runUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> {copy.openRun}</a> : null}
      </div>

      <div className="phase-section">
        <div className="phase-section-heading">
          <div>
            <h3>{copy.phases}</h3>
            {!timelineExpanded && incidentPhaseCount === 0 ? <p className="mobile-phase-note">{copy.noIncidentPhases}</p> : null}
          </div>
          {phases.length ? (
            <button
              className="phase-toggle"
              type="button"
              aria-expanded={timelineExpanded}
              aria-controls="hourly-phase-timeline"
              onClick={() => setTimelineExpanded((current) => !current)}
            >
              {timelineExpanded ? copy.showIncidentPhases : copy.showAllPhases(phases.length)}
              {timelineExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </button>
          ) : null}
        </div>

        {phases.length ? (
          <ol id="hourly-phase-timeline" className={`phase-timeline${timelineExpanded ? ' expanded' : ''}`}>
            {phases.map((item, index) => {
              const labels = PHASE_LABELS[item.name] || [item.name, item.name];
              const incidentPhase = INCIDENT_PHASE_STATUSES.has(item.status);
              return (
                <li
                  key={`${item.name}-${index}`}
                  className={`phase-item status-${item.status} ${incidentPhase ? 'phase-primary' : 'phase-secondary'}`}
                  data-phase-status={item.status}
                >
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
