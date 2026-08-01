import { Activity, ChevronRight, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import MetricCard from '../../components/MetricCard.jsx';
import { formatBangkokDateTime } from '../../utils/dateTime.js';
import { formatCurrency } from '../../utils/formatters.js';
import DashboardInsights from './DashboardInsights.jsx';

function AccountMetrics({ snapshot, language, t }) {
  const { account, positions } = snapshot;
  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const maskedValue = language === 'th' ? 'ปกปิด' : 'Masked';
  const accountValue = (value) => (account.valuesMasked || value === null ? maskedValue : formatCurrency(value));

  return (
    <section className="metrics-grid" aria-label={language === 'th' ? 'ข้อมูลบัญชี' : 'Account metrics'}>
      <MetricCard label={t.cash} value={accountValue(account.cash)} helper={account.valuesMasked ? maskedValue : t.availableBalance} tone="cash" />
      <MetricCard label={t.equity} value={accountValue(account.equity)} helper={account.valuesMasked ? maskedValue : t.brokerSnapshot} />
      <MetricCard label={t.buyingPower} value={accountValue(account.buyingPower)} helper={account.valuesMasked ? maskedValue : t.paperAccount} />
      <MetricCard label={t.positionValue} value={account.valuesMasked ? maskedValue : formatCurrency(totalPositionValue)} helper={`${positions.length} ${t.activePositions}`} />
    </section>
  );
}

function PortfolioHealth({ snapshot, t }) {
  const { positions, openOrders } = snapshot;
  const signals = snapshot.signals ?? snapshot.curatorSignals ?? [];
  const protectedPositions = positions.filter((position) =>
    openOrders.some((order) => order.symbol === position.symbol && order.orderClass === 'bracket'),
  ).length;

  return (
    <section className="health-grid" aria-label={t.portfolioSummary}>
      <article className="health-card"><WalletCards aria-hidden="true" /><div><span>{t.positions}</span><strong>{positions.length}</strong></div></article>
      <article className="health-card"><ShieldCheck aria-hidden="true" /><div><span>{t.bracketProtected}</span><strong>{protectedPositions}/{positions.length}</strong></div></article>
      <article className="health-card"><Activity aria-hidden="true" /><div><span>{t.openOrders}</span><strong>{openOrders.length}</strong></div></article>
      <article className="health-card"><Zap aria-hidden="true" /><div><span>{t.curatorSignals}</span><strong>{signals.length}</strong></div></article>
    </section>
  );
}

function SystemSummary({ snapshot, language, t, onOpenSystem, onOpenPortfolio }) {
  const conclusion = snapshot.workflow?.conclusion || 'unknown';
  const isHealthy = conclusion === 'success' || conclusion === 'completed';

  return (
    <section className={`panel overview-system-card${isHealthy ? ' healthy' : ' attention'}`}>
      <div className="overview-system-copy">
        <span className={`status ${isHealthy ? 'good' : 'warn'}`}>
          <ShieldCheck aria-hidden="true" /> {isHealthy ? t.systemHealthy : t.systemNeedsAttention}
        </span>
        <h2>{t.latestAutomation}</h2>
        <p>{t.latestAutomationDescription}</p>
      </div>
      <div className="overview-system-facts">
        <div><span>{t.workflowStatus}</span><strong>{conclusion}</strong></div>
        <div><span>{t.runtimeMode}</span><strong>{snapshot.runtime?.mode || 'UNKNOWN'}</strong></div>
        <div><span>{t.lastUpdated}</span><strong>{formatBangkokDateTime(snapshot.generatedAt, language, t.notUpdated)}</strong></div>
      </div>
      <div className="overview-quick-actions">
        <button className="secondary-action" type="button" onClick={onOpenPortfolio}>
          {t.openPortfolio}<ChevronRight aria-hidden="true" />
        </button>
        <button className="primary-action" type="button" onClick={onOpenSystem}>
          {t.viewSystemDetails}<ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default function OverviewPage({ snapshot, language, t, onNavigate, readOnlyMessage }) {
  return (
    <div className="page-stack" data-testid="page-overview">
      <SystemSummary
        snapshot={snapshot}
        language={language}
        t={t}
        onOpenSystem={() => onNavigate('system')}
        onOpenPortfolio={() => onNavigate('portfolio')}
      />
      <AccountMetrics snapshot={snapshot} language={language} t={t} />
      <DashboardInsights snapshot={snapshot} language={language} t={t} />
      <PortfolioHealth snapshot={snapshot} t={t} />
      {readOnlyMessage ? (
        <section className="read-only-banner" aria-label="Read-only public snapshot mode">
          <ShieldCheck aria-hidden="true" /><p>{readOnlyMessage}</p>
        </section>
      ) : null}
    </div>
  );
}
