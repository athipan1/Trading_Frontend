import OrdersTable from '../../components/OrdersTable.jsx';
import PositionsTable from '../../components/PositionsTable.jsx';
import SignalsPanel from '../../components/SignalsPanel.jsx';

export default function PortfolioPage({ snapshot, t }) {
  const signals = snapshot.signals ?? snapshot.curatorSignals ?? [];

  return (
    <div className="page-stack" data-testid="page-portfolio">
      <div className="content-grid">
        <PositionsTable positions={snapshot.positions} openOrders={snapshot.openOrders} t={t} />
        <OrdersTable orders={snapshot.openOrders} t={t} />
      </div>
      <SignalsPanel signals={signals} t={t} />
    </div>
  );
}
