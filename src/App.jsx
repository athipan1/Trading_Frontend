import { Activity, RefreshCw, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import MetricCard from './components/MetricCard.jsx';
import OrdersTable from './components/OrdersTable.jsx';
import PositionsTable from './components/PositionsTable.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import { portfolioSnapshot } from './data/mockPortfolio.js';
import { useDashboardSnapshot } from './hooks/useDashboardSnapshot.js';
import { getDashboardDataSource, isMockDataMode } from './services/api.js';
import { formatCurrency } from './utils/formatters.js';

const DATA_SOURCE_LABELS = {
  mock: 'Mock data mode',
  'public-snapshot': 'Public snapshot mode',
  'manager-api': 'Live API mode',
};

function formatUpdatedAt(value) {
  if (!value) return 'Not updated yet';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

export default function App() {
  const { snapshot, isLoading, isRefreshing, error, lastUpdatedAt, refresh, refreshMs } = useDashboardSnapshot();
  const dashboardSnapshot = snapshot ?? portfolioSnapshot;
  const { account, positions, openOrders, curatorSignals } = dashboardSnapshot;
  const mockMode = isMockDataMode();
  const dataSource = getDashboardDataSource();

  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const protectedPositions = positions.filter((position) =>
    openOrders.some((order) => order.symbol === position.symbol && order.orderClass === 'bracket'),
  ).length;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">AI Trading Command Center</p>
          <h1>Portfolio Dashboard</h1>
          <p className="hero-copy">Dynamic frontend for Manager, Database, Execution, Risk, and Curator agent reports.</p>
          <div className="refresh-row">
            <span className={`status ${mockMode ? 'warn' : 'good'}`}>{DATA_SOURCE_LABELS[dataSource] || dataSource}</span>
            <span className="sync-text">Last updated: {formatUpdatedAt(lastUpdatedAt || account.lastSyncedAt)}</span>
            <span className="sync-text">Auto refresh: {Math.round(refreshMs / 1000)}s</span>
          </div>
          {error ? <p className="error-banner">API refresh failed: {error.message}. Showing last known snapshot.</p> : null}
        </div>
        <div className="hero-status">
          <span>{account.mode}</span>
          <strong>{isLoading ? 'LOADING' : account.status}</strong>
          <button className="refresh-button" type="button" onClick={() => refresh()} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? 'spinning' : ''} />
            Refresh
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Cash" value={formatCurrency(account.cash)} helper="Available balance" tone="cash" />
        <MetricCard label="Equity" value={formatCurrency(account.equity)} helper="Broker snapshot" />
        <MetricCard label="Buying Power" value={formatCurrency(account.buyingPower)} helper="Paper account" />
        <MetricCard label="Position Value" value={formatCurrency(totalPositionValue)} helper={`${positions.length} active positions`} />
      </section>

      <section className="health-grid">
        <article className="health-card">
          <WalletCards />
          <div>
            <span>Positions</span>
            <strong>{positions.length}</strong>
          </div>
        </article>
        <article className="health-card">
          <ShieldCheck />
          <div>
            <span>Bracket Protected</span>
            <strong>{protectedPositions}/{positions.length}</strong>
          </div>
        </article>
        <article className="health-card">
          <Activity />
          <div>
            <span>Open Orders</span>
            <strong>{openOrders.length}</strong>
          </div>
        </article>
        <article className="health-card">
          <Zap />
          <div>
            <span>Curator Signals</span>
            <strong>{curatorSignals.length}</strong>
          </div>
        </article>
      </section>

      <div className="content-grid">
        <PositionsTable positions={positions} openOrders={openOrders} />
        <OrdersTable orders={openOrders} />
      </div>

      <SignalsPanel signals={curatorSignals} />
    </main>
  );
}
