import { formatCurrency, pnlClassName } from '../utils/formatters';

export default function PositionsTable({ positions, openOrders, t }) {
  const orderBySymbol = new Map(openOrders.map((order) => [order.symbol, order]));
  const displayNumber = (value, masked) => (masked || value === null ? t.masked : value);
  const displayCurrency = (value, masked) => (masked || value === null ? t.masked : formatCurrency(value));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.livePortfolio}</p>
          <h2>{t.positions}</h2>
        </div>
        <span className="pill">{t.dynamic}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.symbol}</th>
              <th>{t.bucket}</th>
              <th>{t.qty}</th>
              <th>{t.avg}</th>
              <th>{t.current}</th>
              <th>{t.pnl}</th>
              <th>TP/SL</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const order = orderBySymbol.get(position.symbol);
              const masked = Boolean(position.valuesMasked);
              return (
                <tr key={position.symbol}>
                  <td className="symbol">{position.symbol}</td>
                  <td><span className="bucket">{position.bucket}</span></td>
                  <td>{displayNumber(position.quantity, masked)}</td>
                  <td>{displayCurrency(position.averageCost, masked)}</td>
                  <td>{displayCurrency(position.currentPrice, masked)}</td>
                  <td className={masked ? 'neutral' : pnlClassName(position.unrealizedPnL)}>{displayCurrency(position.unrealizedPnL, masked)}</td>
                  <td>{order?.orderClass === 'bracket' ? <span className="status good">{t.protected}</span> : <span className="status warn">{t.needsReview}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">{t.positionsHint}</p>
    </section>
  );
}
