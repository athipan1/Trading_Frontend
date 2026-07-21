import { useEffect, useMemo, useState } from 'react';
import { Activity, Languages, RefreshCw, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import MetricCard from './components/MetricCard.jsx';
import OrdersTable from './components/OrdersTable.jsx';
import PositionsTable from './components/PositionsTable.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import { DATA_SOURCES } from './config/dashboardConfig.js';
import { emptyDashboardSnapshot } from './data/emptyDashboard.js';
import { useDashboardSnapshot } from './hooks/useDashboardSnapshot.js';
import { getInitialLanguage, translations } from './i18n.js';
import { getDashboardDataSource } from './services/api.js';
import { formatCurrency } from './utils/formatters.js';

function formatUpdatedAt(value, language, fallback) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const t = useMemo(() => translations[language], [language]);
  const { snapshot, isLoading, isRefreshing, error, lastUpdatedAt, refresh, refreshMs } = useDashboardSnapshot();
  const dashboardSnapshot = snapshot ?? emptyDashboardSnapshot;
  const { account, positions, openOrders, curatorSignals } = dashboardSnapshot;
  const dataSource = getDashboardDataSource();
  const mockMode = dataSource === DATA_SOURCES.MOCK;

  useEffect(() => {
    window.localStorage.setItem('trading-dashboard-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const protectedPositions = positions.filter((position) =>
    openOrders.some((order) => order.symbol === position.symbol && order.orderClass === 'bracket'),
  ).length;

  const toggleLanguage = () => setLanguage((current) => (current === 'th' ? 'en' : 'th'));

  return (
    <main className="app-shell">
      <div className="top-actions">
        <button className="language-switcher" type="button" onClick={toggleLanguage} aria-label="Switch language">
          <Languages />
          <span>{language === 'th' ? 'EN' : 'ไทย'}</span>
        </button>
      </div>

      <section className="hero">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="hero-copy">{t.subtitle}</p>
          <div className="refresh-row">
            <span className={`status ${mockMode ? 'warn' : 'good'}`} data-testid="data-source">
              {mockMode ? t.mockMode : `${t.liveMode}: ${dataSource}`}
            </span>
            <span className="sync-text">
              {t.lastUpdated}: {formatUpdatedAt(lastUpdatedAt || account.lastSyncedAt, language, t.notUpdated)}
            </span>
            <span className="sync-text">{t.autoRefresh}: {Math.round(refreshMs / 1000)}s</span>
          </div>
          {error ? (
            <p className="error-banner" role="alert">
              {t.apiFailed}: {error.message}. {snapshot ? t.showingLastSnapshot : t.noSnapshotAvailable}
            </p>
          ) : null}
        </div>
        <div className="hero-status">
          <span data-testid="trading-mode">{account.mode}</span>
          <strong>{isLoading ? t.loading : account.status}</strong>
          <button className="refresh-button" type="button" onClick={() => refresh()} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? 'spinning' : ''} />
            {t.refresh}
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label={t.cash} value={formatCurrency(account.cash)} helper={t.availableBalance} tone="cash" />
        <MetricCard label={t.equity} value={formatCurrency(account.equity)} helper={t.brokerSnapshot} />
        <MetricCard label={t.buyingPower} value={formatCurrency(account.buyingPower)} helper={t.paperAccount} />
        <MetricCard label={t.positionValue} value={formatCurrency(totalPositionValue)} helper={`${positions.length} ${t.activePositions}`} />
      </section>

      <section className="health-grid">
        <article className="health-card">
          <WalletCards />
          <div><span>{t.positions}</span><strong>{positions.length}</strong></div>
        </article>
        <article className="health-card">
          <ShieldCheck />
          <div><span>{t.bracketProtected}</span><strong>{protectedPositions}/{positions.length}</strong></div>
        </article>
        <article className="health-card">
          <Activity />
          <div><span>{t.openOrders}</span><strong>{openOrders.length}</strong></div>
        </article>
        <article className="health-card">
          <Zap />
          <div><span>{t.curatorSignals}</span><strong>{curatorSignals.length}</strong></div>
        </article>
      </section>

      <div className="content-grid">
        <PositionsTable positions={positions} openOrders={openOrders} t={t} />
        <OrdersTable orders={openOrders} t={t} />
      </div>

      <SignalsPanel signals={curatorSignals} t={t} />
      <p className="schema-version" data-testid="schema-version">{dashboardSnapshot.schemaVersion}</p>
    </main>
  );
}
