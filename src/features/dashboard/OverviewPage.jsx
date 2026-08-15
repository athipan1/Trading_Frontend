import { useState } from 'react';
import { Activity, ChevronRight, ShieldCheck, TriangleAlert, WalletCards, Zap } from 'lucide-react';
import MetricCard from '../../components/MetricCard.jsx';
import { SYSTEM_COPY, deriveSystemIncident } from '../../components/systemIncidentModel.js';
import { getOwnerDashboardSnapshot } from '../../services/controlApi.js';
import { formatBangkokDateTime } from '../../utils/dateTime.js';
import { formatCurrency } from '../../utils/formatters.js';
import DashboardInsights from './DashboardInsights.jsx';

function AccountMetrics({ snapshot, t }) {
  const { account, positions } = snapshot;
  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const maskedValue = t.masked;
  const accountValue = (value) => (account.valuesMasked || value === null ? maskedValue : formatCurrency(value));

  return (
    <section className="metrics-grid">
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

function NaturalLanguageCycleSummary({ snapshot, language, onOpenSystem }) {
  const thai = language === 'th';
  const copy = SYSTEM_COPY[thai ? 'th' : 'en'];
  const incident = deriveSystemIncident(snapshot, copy);
  const needsAttention = incident.severity === 'critical' || incident.severity === 'warning';
  const Icon = needsAttention ? TriangleAlert : ShieldCheck;

  return (
    <section
      className={`panel overview-system-card ${needsAttention ? 'attention' : 'healthy'}`}
      aria-label={thai ? 'คำอธิบายรอบการทำงานล่าสุด' : 'Latest automation explanation'}
      data-testid="overview-natural-language-summary"
    >
      <div className="overview-system-copy">
        <span className={`status ${needsAttention ? 'warn' : 'good'}`}>
          <Icon aria-hidden="true" />
          {thai ? 'สรุปแบบเข้าใจง่าย' : 'Plain-language summary'}
        </span>
        <h2>{incident.title}</h2>
        <p>{incident.detail}</p>
      </div>
      <div className="overview-system-facts">
        <div>
          <span>{thai ? 'เกิดอะไรขึ้น' : 'What happened'}</span>
          <strong>{incident.title}</strong>
        </div>
        <div>
          <span>{thai ? 'ระบบจะทำอะไรต่อ' : 'What happens next'}</span>
          <strong>{incident.action}</strong>
        </div>
        <div>
          <span>{thai ? 'สถานะ' : 'Status'}</span>
          <strong>{needsAttention ? (thai ? 'ควรตรวจสอบ' : 'Needs review') : (thai ? 'ทำงานตามปกติ' : 'Operating normally')}</strong>
        </div>
      </div>
      <div className="overview-quick-actions">
        <button className="secondary-action" type="button" onClick={onOpenSystem}>
          {thai ? 'ดูรายละเอียดทางเทคนิค' : 'View technical details'}
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function mergeOwnerValues(snapshot, owner) {
  return owner ? {
    ...snapshot,
    account: owner.account,
    positions: owner.positions,
    openOrders: owner.openOrders,
    privacy: { ...snapshot.privacy, valuesMasked: false },
  } : snapshot;
}

function OwnerSecureView({ language, active, connecting, error, onConnect, onDisconnect }) {
  const [token, setToken] = useState('');
  const thai = language === 'th';
  const toggle = () => {
    if (active) {
      setToken('');
      onDisconnect();
    } else {
      onConnect(token.trim());
    }
  };

  return (
    <section className="operator-bar" data-testid="owner-secure-view" aria-label="Owner secure view">
      <input
        aria-label="Owner token"
        data-testid="owner-token-input"
        type="password"
        autoComplete="off"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="WEB_CONTROL_OPERATOR_TOKEN"
        disabled={connecting}
      />
      <button
        className={active ? 'secondary-action' : 'primary-action'}
        data-testid={active ? 'owner-hide-values' : 'owner-connect-button'}
        type="button"
        disabled={!active && (connecting || !token.trim())}
        onClick={toggle}
      >
        {active ? (thai ? 'ซ่อนข้อมูล' : 'Hide values') : connecting ? '…' : (thai ? 'แสดงข้อมูลจริง' : 'Show values')}
      </button>
      {error || active ? (
        <p className={`status ${error ? 'warn' : 'good'}`} role="status" data-testid="owner-secure-status">
          {error || (thai ? 'ยืนยันเจ้าของแล้ว · read-only' : 'Owner verified · read-only')}
        </p>
      ) : null}
    </section>
  );
}

export default function OverviewPage({ snapshot, language, t, onNavigate, readOnlyMessage }) {
  const [ownerSnapshot, setOwnerSnapshot] = useState(null);
  const [ownerConnecting, setOwnerConnecting] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const effectiveSnapshot = mergeOwnerValues(snapshot, ownerSnapshot);

  const connectOwner = async (operatorToken) => {
    setOwnerConnecting(true);
    setOwnerError('');
    try {
      setOwnerSnapshot(await getOwnerDashboardSnapshot({ operatorToken }));
    } catch (error) {
      setOwnerSnapshot(null);
      setOwnerError(String(error?.message || 'Authentication failed').slice(0, 180));
    } finally {
      setOwnerConnecting(false);
    }
  };

  return (
    <div className="page-stack" data-testid="page-overview">
      {readOnlyMessage || snapshot.account?.valuesMasked || ownerSnapshot ? (
        <OwnerSecureView
          language={language}
          active={Boolean(ownerSnapshot)}
          connecting={ownerConnecting}
          error={ownerError}
          onConnect={connectOwner}
          onDisconnect={() => {
            setOwnerSnapshot(null);
            setOwnerError('');
          }}
        />
      ) : null}
      <SystemSummary
        snapshot={effectiveSnapshot}
        language={language}
        t={t}
        onOpenSystem={() => onNavigate('system')}
        onOpenPortfolio={() => onNavigate('portfolio')}
      />
      <NaturalLanguageCycleSummary
        snapshot={effectiveSnapshot}
        language={language}
        onOpenSystem={() => onNavigate('system')}
      />
      <AccountMetrics snapshot={effectiveSnapshot} t={t} />
      <DashboardInsights snapshot={effectiveSnapshot} language={language} t={t} />
      <PortfolioHealth snapshot={effectiveSnapshot} t={t} />
      {readOnlyMessage && !ownerSnapshot ? (
        <section className="read-only-banner" aria-label="Read-only public snapshot mode">
          <ShieldCheck aria-hidden="true" /><p>{readOnlyMessage}</p>
        </section>
      ) : null}
    </div>
  );
}
