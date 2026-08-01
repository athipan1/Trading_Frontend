import {
  Activity,
  ChartNoAxesColumnIncreasing,
  Gauge,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { formatBangkokDateTime } from '../../utils/dateTime.js';
import { formatCurrency } from '../../utils/formatters.js';
import { deriveRiskDashboard } from './riskDashboardModel.js';

function formatPercentage(value, unavailable) {
  return value === null || value === undefined ? unavailable : `${value.toFixed(1)}%`;
}

function SourceBadge({ source, t }) {
  return <span className={`risk-source ${source}`}>{t.riskSources[source]}</span>;
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'neutral', testId }) {
  return (
    <article className={`risk-metric-card ${tone}`} data-testid={testId}>
      <span className="risk-metric-icon"><Icon aria-hidden="true" /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function RiskGauge({ risk, t }) {
  const gaugeValue = risk.riskScore ?? risk.grossExposurePercent;
  const boundedValue = Math.min(100, Math.max(0, gaugeValue ?? 0));
  const label = risk.riskScore === null ? t.grossExposure : t.riskScore;
  return (
    <article className="panel risk-chart-panel" data-testid="risk-gauge">
      <div className="section-heading">
        <div><p className="eyebrow">{t.riskPosture}</p><h2>{t.riskGauge}</h2></div>
        <Gauge aria-hidden="true" />
      </div>
      <div className={`risk-gauge ${risk.riskLevel}`}>
        <div
          className="risk-gauge-ring"
          style={{ '--risk-gauge-value': `${boundedValue * 3.6}deg` }}
          aria-hidden="true"
        >
          <div><strong>{formatPercentage(gaugeValue, '—')}</strong><span>{label}</span></div>
        </div>
        <div className="risk-gauge-copy">
          <span>{t.riskLevel}</span>
          <strong>{t.riskLevelLabels[risk.riskLevel]}</strong>
          <p>{risk.riskTelemetryPublished ? t.riskLevelPublished : t.riskLevelUnavailableDescription}</p>
        </div>
      </div>
    </article>
  );
}

function SectorChart({ risk, t }) {
  return (
    <article className="panel risk-chart-panel" data-testid="sector-allocation">
      <div className="section-heading">
        <div><p className="eyebrow">{t.concentration}</p><h2>{t.sectorAllocation}</h2></div>
        <ChartNoAxesColumnIncreasing aria-hidden="true" />
      </div>
      {risk.sectorAllocation.length ? (
        <ol className="risk-sector-chart">
          {risk.sectorAllocation.map((allocation) => (
            <li key={allocation.sector}>
              <div><strong>{allocation.sector}</strong><span>{formatPercentage(allocation.percent, '—')}</span></div>
              <div className="risk-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(2, allocation.percent))}%` }} /></div>
              <small>{allocation.marketValue === null ? t.telemetryUnavailable : formatCurrency(allocation.marketValue)}</small>
            </li>
          ))}
        </ol>
      ) : <p className="risk-empty">{t.sectorUnavailable}</p>}
      <SourceBadge source={risk.sectorSource} t={t} />
    </article>
  );
}

function LimitRow({ label, value, limit, utilization, unavailable }) {
  const width = utilization === null ? 0 : Math.min(100, Math.max(0, utilization));
  return (
    <div className="risk-limit-row">
      <div><strong>{label}</strong><span>{formatPercentage(value, unavailable)} / {formatPercentage(limit, unavailable)}</span></div>
      <div className="risk-limit-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function EmergencyHalt({ halt, language, t }) {
  const state = !halt.published || halt.active === null ? 'unknown' : halt.active ? 'active' : 'inactive';
  const Icon = halt.active ? TriangleAlert : LockKeyhole;
  return (
    <section className={`risk-halt ${state}`} data-testid="emergency-halt" aria-labelledby="emergency-halt-heading">
      <span className="risk-halt-icon"><Icon aria-hidden="true" /></span>
      <div>
        <p className="eyebrow">{t.emergencyControlBoundary}</p>
        <h2 id="emergency-halt-heading">{t.emergencyHalt}</h2>
        <p>{halt.published ? (halt.reason || t.emergencyHaltNoReason) : t.emergencyHaltUnavailableDescription}</p>
      </div>
      <dl>
        <div><dt>{t.agentStatus}</dt><dd>{t.emergencyHaltStates[state]}</dd></div>
        <div><dt>{t.lastUpdated}</dt><dd>{formatBangkokDateTime(halt.updatedAt, language, t.telemetryUnavailable)}</dd></div>
      </dl>
      <span className="status neutral-status">{t.readOnly}</span>
    </section>
  );
}

export default function RiskDashboardPage({ snapshot, language, t }) {
  const risk = deriveRiskDashboard(snapshot);
  const protectionTone = risk.protection.totalCount > 0 && risk.protection.protectedCount < risk.protection.totalCount
    ? 'warning' : 'good';
  return (
    <div className="page-stack risk-dashboard" data-testid="page-risk">
      <section className="risk-boundary" aria-label={t.riskBoundaryTitle}>
        <span className="risk-boundary-icon"><ShieldCheck aria-hidden="true" /></span>
        <div><p className="eyebrow">{t.riskBoundaryEyebrow}</p><h2>{t.riskBoundaryTitle}</h2><p>{t.riskBoundaryDescription}</p></div>
        <span className="status good">{t.managerOnly}</span>
      </section>

      {!risk.riskTelemetryPublished ? (
        <div className="risk-contract-notice" role="status">
          <ShieldAlert aria-hidden="true" />
          <div><strong>{t.riskTelemetryPendingTitle}</strong><p>{t.riskTelemetryPendingDescription}</p></div>
        </div>
      ) : null}

      <section className="risk-metric-grid" aria-label={t.riskSummary}>
        <MetricCard icon={ShieldAlert} label={t.riskLevel} value={t.riskLevelLabels[risk.riskLevel]} detail={risk.riskTelemetryPublished ? t.managerPublished : t.telemetryUnavailable} tone={risk.riskLevel} testId="risk-level" />
        <MetricCard icon={Activity} label={t.grossExposure} value={formatPercentage(risk.grossExposurePercent, t.telemetryUnavailable)} detail={<SourceBadge source={risk.exposureSource} t={t} />} testId="gross-exposure" />
        <MetricCard icon={Gauge} label={t.drawdown} value={formatPercentage(risk.drawdownPercent, t.telemetryUnavailable)} detail={risk.drawdownPercent === null ? t.managerMustPublish : t.managerPublished} testId="drawdown" />
        <MetricCard icon={ShieldCheck} label={t.protectionCoverage} value={formatPercentage(risk.protection.percent, t.telemetryUnavailable)} detail={`${risk.protection.protectedCount} / ${risk.protection.totalCount} ${t.positions.toLowerCase()}`} tone={protectionTone} testId="protection-coverage" />
      </section>

      <section className="risk-chart-grid" aria-label={t.riskCharts}>
        <RiskGauge risk={risk} t={t} />
        <SectorChart risk={risk} t={t} />
        <article className="panel risk-chart-panel risk-limits" data-testid="risk-limits">
          <div className="section-heading">
            <div><p className="eyebrow">{t.riskLimits}</p><h2>{t.limitUtilization}</h2></div>
            <Activity aria-hidden="true" />
          </div>
          <LimitRow label={t.grossExposure} value={risk.grossExposurePercent} limit={risk.limits.grossExposurePercent} utilization={risk.limits.grossUtilization} unavailable={t.telemetryUnavailable} />
          <LimitRow label={t.drawdown} value={risk.drawdownPercent} limit={risk.limits.drawdownPercent} utilization={risk.limits.drawdownUtilization} unavailable={t.telemetryUnavailable} />
          <dl className="risk-exposure-values">
            <div><dt>{t.grossExposureValue}</dt><dd>{risk.grossExposureValue === null ? t.masked : formatCurrency(risk.grossExposureValue)}</dd></div>
            <div><dt>{t.netExposure}</dt><dd>{formatPercentage(risk.netExposurePercent, t.telemetryUnavailable)}</dd></div>
          </dl>
        </article>
      </section>

      <EmergencyHalt halt={risk.emergencyHalt} language={language} t={t} />

      <section className="panel risk-evidence" aria-labelledby="risk-evidence-heading">
        <div className="section-heading">
          <div><p className="eyebrow">{t.riskEvidenceEyebrow}</p><h2 id="risk-evidence-heading">{t.riskEvidenceTitle}</h2></div>
          <span className={`status ${risk.riskPhase?.status === 'success' ? 'good' : 'warn'}`}>{risk.riskPhase?.status || t.telemetryUnavailable}</span>
        </div>
        <p>{t.riskEvidenceDescription}</p>
        <dl>
          <div><dt>{t.agentStatus}</dt><dd>{risk.riskPhase?.message || risk.riskPhase?.status || t.telemetryUnavailable}</dd></div>
          <div><dt>{t.lastUpdated}</dt><dd>{formatBangkokDateTime(snapshot.generatedAt, language, t.notUpdated)}</dd></div>
          <div><dt>{t.riskDataSource}</dt><dd>{risk.riskTelemetryPublished ? t.managerPublished : t.calculatedSnapshotOnly}</dd></div>
        </dl>
      </section>
    </div>
  );
}
