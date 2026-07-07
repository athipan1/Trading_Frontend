import { formatCurrency } from '../utils/formatters';

export default function OrdersTable({ orders }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Risk Guardrails</p>
          <h2>Open Orders</h2>
        </div>
        <span className="pill">{orders.length} active</span>
      </div>
      <div className="order-grid">
        {orders.map((order) => (
          <article className="order-card" key={`${order.symbol}-${order.takeProfit}`}>
            <div>
              <span className="symbol">{order.symbol}</span>
              <p>{order.side.toUpperCase()} {order.quantity} • {order.type}</p>
            </div>
            <div className="order-meta">
              <span>TP {formatCurrency(order.takeProfit)}</span>
              <span>SL {order.stopLoss ? 'Active' : 'Missing'}</span>
              <strong>{order.orderClass}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
