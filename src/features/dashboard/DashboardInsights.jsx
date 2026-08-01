import { Activity, ChartNoAxesColumnIncreasing, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PHASE_LABELS, statusLabel } from '../../components/systemIncidentModel.js';
import { formatCurrency, formatPercent, pnlClassName } from '../../utils/formatters.js';
import { deriveDashboardInsights } from './dashboardInsightsModel.js';
import './dashboardInsights.css';

function phaseLabel(name, language) {
  const labels = PHASE_LABELS[name];
  if (!labels) return statusLabel(name);
  return labels[language === 'th' ? 0 : 1];
}

function AllocationChart({ insights, t }) {
  if (insights.allocations.length === 0) {
    return <p className="dashboard-insight-empty">{t.allocationUnavailable}</p>;
  }

  return (
    <ol className="allocation-chart" aria-label={t.portfolioAllocation} data-testid="allocation-chart">
      {insights.allocations.map((allocation) => (
        <li key={allocation.symbol}>
          <div className="allocation-label">
            <strong>{allocation.symbol}</strong>
            <span>{formatPercent(allocation.share)}</span>
          </div>
          <div className="allocation-track" aria-hidden="true">
            <span style={{ width: `${Math.max(allocation.share * 100, 2)}%` }} />
          </div>
          <small>{formatCurrency(allocation.marketValue)}</small>
        </li>
      ))}
    </ol>
  );
}

function RecentActivity({ insights, language, t }) {
  if (insights.recentPhases.length === 0) {
    return <p className="dashboard-insight-empty">{t.activityUnavailable}</p>;
  }

  return (
    <ol
      className="dashboard-activity-list"
      aria-label={t.recentActivity}
      data-testid="recent-automation-activity"
    >
      {insights.recentPhases.map((phase, index) => (
        <li key={`${phase.name}-${index}`}>
          <span className={`activity-marker ${phase.status}`} aria-hidden="true" />
          <div>
            <strong>{phaseLabel(phase.name, language)}</strong>
            <small>{phase.message || statusLabel(phase.status)}</small>
          </div>
          <span className={`status ${phase.status === 'success' ? 'good' : 'warn'}`}>
            {statusLabel(phase.status)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function DashboardInsights({ snapshot, language, t }) {
  const insights = deriveDashboardInsights(snapshot);
  const safe = insights.safetyState === 'safe';
  const critical = insights.safetyState === 'critical';
  const pnl = insights.unrealizedPnL;
  const safetyLabel = safe
    ? t.paperBoundaryActive
    : critical ? t.unsafeRuntime : t.runtimeUnknown;

  return (
    <section className="dashboard-insights" aria-label={t.dashboardInsights} data-testid="dashboard-insights">
      <article className="panel dashboard-insight-panel allocation-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.portfolioAnalytics}</p>
            <h2>{t.portfolioAllocation}</h2>
          </div>
          <ChartNoAxesColumnIncreasing aria-hidden="true" />
        </div>
        <AllocationChart insights={insights} t={t} />
        <dl className="dashboard-insight-summary">
          <div>
            <dt>{t.investedValue}</dt>
            <dd>{insights.valuesMasked ? t.masked : formatCurrency(insights.totalMarketValue)}</dd>
          </div>
          <div>
            <dt>{t.unrealizedPnl}</dt>
            <dd className={pnl === null ? 'neutral' : pnlClassName(pnl)}>
              {pnl === null ? t.masked : formatCurrency(pnl)}
            </dd>
          </div>
        </dl>
      </article>

      <article className="panel dashboard-insight-panel activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.automationPulse}</p>
            <h2>{t.recentActivity}</h2>
          </div>
          <Activity aria-hidden="true" />
        </div>
        <div className={`dashboard-safety-posture ${insights.safetyState}`} data-testid="safety-posture">
          {safe ? <ShieldCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          <div>
            <strong>{safetyLabel}</strong>
            <span>{t.workflow}: {statusLabel(insights.workflowConclusion)}</span>
          </div>
        </div>
        <RecentActivity insights={insights} language={language} t={t} />
      </article>
    </section>
  );
}
