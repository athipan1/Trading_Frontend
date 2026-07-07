import { formatCurrency, formatNumber, pnlClassName } from '../utils/formatters';

export default function PositionsTable({ positions, openOrders }) {
  const orderBySymbol = new Map(openOrders.map((order) => [order.symbol, order]));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live Portfolio</p>
          <h2>Positions</h2>
        </div>
        <span className="pill">Dynamic</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Bucket</th>
              <th>Qty</th>
              <th>Avg</th>
              <th>Current</th>
              <th>P/L</th>
              <th>TP/SL</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const order = orderBySymbol.get(position.symbol);
              return (
                <tr key={position.symbol}>
                  <td className="symbol">{position.symbol}</td>
                  <td><span className="bucket">{position.bucket}</span></td>
                  <td>{position.quantity}</td>
                  <td>{formatCurrency(position.averageCost)}</td>
                  <td>{formatCurrency(position.currentPrice)}</td>
                  <td className={pnlClassName(position.unrealizedPnL)}>{formatCurrency(position.unrealizedPnL)}</td>
                  <td>{order?.orderClass === 'bracket' ? <span className="status good">Protected</span> : <span className="status warn">Needs review</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">New positions render automatically from the latest API snapshot. Nothing is hardcoded by symbol.</p>
    </section>
  );
}
