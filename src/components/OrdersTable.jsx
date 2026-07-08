import { formatCurrency } from '../utils/formatters';

export default function OrdersTable({ orders, t }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.riskGuardrails}</p>
          <h2>{t.openOrders}</h2>
        </div>
        <span className="pill">{orders.length} {t.active}</span>
      </div>
      <div className="order-grid">
        {orders.map((order) => (
          <article className="order-card" key={`${order.symbol}-${order.takeProfit}`}>
            <div>
              <span className="symbol">{order.symbol}</span>
              <p>{order.side} {order.quantity} · {order.type}</p>
            </div>
            <div className="order-meta">
              <span>TP {formatCurrency(order.takeProfit)}</span>
              <span>SL {order.stopLoss ? t.stopActive : t.stopMissing}</span>
              <strong>{order.orderClass}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
