import { useState } from 'react';
import { Activity, ChevronRight, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import MetricCard from '../../components/MetricCard.jsx';
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

function mergeOwnerValues(snapshot, owner) {
  if (!owner) return snapshot;
  return {
    ...snapshot,
    account: { ...snapshot.account, ...owner.account, valuesMasked: false },
    positions: owner.positions.map((item) => ({ ...item, valuesMasked: false, quantityMasked: false })),
    openOrders: owner.openOrders.map((item) => ({ ...item, valuesMasked: false })),
    privacy: { ...snapshot.privacy, mode: 'owner-authenticated', valuesMasked: false },
  };
}

function OwnerSecureView({ language, active, connecting, error, onConnect, onDisconnect }) {
  const [token, setToken] = useState('');
  const thai = language === 'th';

  return (
    <section className="operator-bar" data-testid="owner-secure-view" aria-label="Owner secure view">
      <label>
        <span><ShieldCheck aria-hidden="true" /> Owner Secure View · {thai ? 'Token ไม่ถูกบันทึก' : 'token is not stored'}</span>
        <input
          data-testid="owner-token-input"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="WEB_CONTROL_OPERATOR_TOKEN"
          disabled={connecting}
        />
      </label>
      <button
        className={active ? 'secondary-action' : 'primary-action'}
        data-testid={active ? 'owner-hide-values' : 'owner-connect-button'}
        type="button"
        disabled={!active && (connecting || !token.trim())}
        onClick={() => {
          if (active) {
            setToken('');
            onDisconnect();
          } else {
            onConnect(token.trim());
          }
        }}
      >
        {active ? (thai ? 'ซ่อนข้อมูล' : 'Hide values') : connecting ? (thai ? 'กำลังยืนยัน…' : 'Authenticating…') : (thai ? 'แสดงข้อมูลจริง' : 'Show real values')}
      </button>
      <p className={`status ${error ? 'warn' : 'good'}`} role="status" data-testid="owner-secure-status">
        {error || (active ? (thai ? 'ยืนยันเจ้าของแล้ว · read-only' : 'Owner verified · read-only') : (thai ? 'ข้อมูลยังปกปิดอยู่' : 'Values remain masked'))}
      </p>
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
      setOwnerError(String(error?.message || (language === 'th' ? 'ยืนยันไม่สำเร็จ' : 'Authentication failed')).slice(0, 180));
    } finally {
      setOwnerConnecting(false);
    }
  };

  return (
    <div className="page-stack" data-testid="page-overview">
      {snapshot.account?.valuesMasked || ownerSnapshot ? (
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
