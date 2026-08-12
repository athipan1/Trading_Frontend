import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronRight,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
  Zap,
} from 'lucide-react';
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

function mergeOwnerValues(publicSnapshot, ownerSnapshot) {
  if (!ownerSnapshot) return publicSnapshot;

  const publicPositions = new Map(
    (publicSnapshot.positions ?? []).map((position) => [position.symbol, position]),
  );
  const positions = (ownerSnapshot.positions ?? []).map((position) => ({
    ...(publicPositions.get(position.symbol) ?? {}),
    ...position,
    valuesMasked: false,
    quantityMasked: false,
  }));

  return {
    ...publicSnapshot,
    account: {
      ...publicSnapshot.account,
      ...ownerSnapshot.account,
      valuesMasked: false,
    },
    positions,
    openOrders: (ownerSnapshot.openOrders ?? []).map((order) => ({
      ...order,
      valuesMasked: false,
    })),
    privacy: {
      ...(publicSnapshot.privacy ?? {}),
      mode: 'owner-authenticated',
      valuesMasked: false,
    },
  };
}

function OwnerSecureView({ language, isActive, onConnect, onDisconnect, isConnecting, error }) {
  const [operatorToken, setOperatorToken] = useState('');
  const thai = language === 'th';

  const connect = async () => {
    const token = operatorToken.trim();
    if (!token) return;
    await onConnect(token);
  };

  return (
    <section className="operator-bar" data-testid="owner-secure-view" aria-label="Owner secure view">
      <label>
        <span>
          <LockKeyhole aria-hidden="true" />
          {thai ? 'Owner Secure View · Token ไม่ถูกบันทึกในเบราว์เซอร์' : 'Owner Secure View · token is not stored in the browser'}
        </span>
        <input
          data-testid="owner-token-input"
          type="password"
          autoComplete="off"
          value={operatorToken}
          onChange={(event) => setOperatorToken(event.target.value)}
          placeholder={thai ? 'ใส่ WEB_CONTROL_OPERATOR_TOKEN' : 'Enter WEB_CONTROL_OPERATOR_TOKEN'}
          disabled={isConnecting}
        />
      </label>
      {isActive ? (
        <button
          className="secondary-action"
          data-testid="owner-hide-values"
          type="button"
          onClick={() => {
            setOperatorToken('');
            onDisconnect();
          }}
        >
          <EyeOff aria-hidden="true" /> {thai ? 'ซ่อนข้อมูล' : 'Hide values'}
        </button>
      ) : (
        <button
          className="primary-action"
          data-testid="owner-connect-button"
          type="button"
          onClick={connect}
          disabled={isConnecting || !operatorToken.trim()}
        >
          <LockKeyhole aria-hidden="true" /> {isConnecting ? (thai ? 'กำลังยืนยัน…' : 'Authenticating…') : (thai ? 'แสดงข้อมูลจริง' : 'Show real values')}
        </button>
      )}
      <p className={`status ${error ? 'warn' : 'good'}`} role="status" data-testid="owner-secure-status">
        {error || (isActive
          ? (thai ? 'ยืนยันเจ้าของแล้ว · ข้อมูลจริงมาจาก Manager_Agent แบบ read-only' : 'Owner verified · real values loaded read-only from Manager_Agent')
          : (thai ? 'ข้อมูลสาธารณะยังคงปกปิดจนกว่าจะยืนยันตัวตน' : 'Public values stay masked until owner authentication'))}
      </p>
    </section>
  );
}

export default function OverviewPage({ snapshot, language, t, onNavigate, readOnlyMessage }) {
  const [ownerSnapshot, setOwnerSnapshot] = useState(null);
  const [ownerConnecting, setOwnerConnecting] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const effectiveSnapshot = useMemo(
    () => mergeOwnerValues(snapshot, ownerSnapshot),
    [ownerSnapshot, snapshot],
  );
  const ownerSecureViewRelevant = Boolean(snapshot.account?.valuesMasked || ownerSnapshot);

  const connectOwner = async (operatorToken) => {
    setOwnerConnecting(true);
    setOwnerError('');
    try {
      const fullSnapshot = await getOwnerDashboardSnapshot({
        operatorToken,
        accountId: '1',
      });
      setOwnerSnapshot(fullSnapshot);
    } catch (error) {
      const fallback = language === 'th' ? 'ยืนยัน Owner Secure View ไม่สำเร็จ' : 'Owner Secure View authentication failed';
      const message = typeof error?.message === 'string' ? error.message : fallback;
      setOwnerSnapshot(null);
      setOwnerError(message.replace(/\s+/g, ' ').trim().slice(0, 180) || fallback);
    } finally {
      setOwnerConnecting(false);
    }
  };

  return (
    <div className="page-stack" data-testid="page-overview">
      {ownerSecureViewRelevant ? (
        <OwnerSecureView
          language={language}
          isActive={Boolean(ownerSnapshot)}
          isConnecting={ownerConnecting}
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
