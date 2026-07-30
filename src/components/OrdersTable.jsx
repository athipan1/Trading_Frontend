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
        {orders.map((order) => {
          const quantity = order.valuesMasked || order.quantity === null ? t.masked : order.quantity;
          const takeProfit = order.valuesMasked || order.takeProfit === null ? t.masked : formatCurrency(order.takeProfit);
          return (
            <article className="order-card" key={`${order.symbol}-${order.orderClass}-${order.type}`}>
              <div>
                <span className="symbol">{order.symbol}</span>
                <p>{order.side} {quantity} · {order.type}</p>
              </div>
              <div className="order-meta">
                <span>TP {takeProfit}</span>
                <span>SL {order.stopLoss ? t.stopActive : t.stopMissing}</span>
                <strong>{order.orderClass}</strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
