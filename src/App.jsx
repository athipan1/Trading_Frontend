import { Activity, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import MetricCard from './components/MetricCard.jsx';
import OrdersTable from './components/OrdersTable.jsx';
import PositionsTable from './components/PositionsTable.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import { portfolioSnapshot } from './data/mockPortfolio.js';
import { formatCurrency } from './utils/formatters.js';

export default function App() {
  const snapshot = portfolioSnapshot;
  const { account, positions, openOrders, curatorSignals } = snapshot;

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
        </div>
        <div className="hero-status">
          <span>{account.mode}</span>
          <strong>{account.status}</strong>
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
