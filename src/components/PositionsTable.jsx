import { BriefcaseBusiness } from 'lucide-react';
import { formatCurrency, pnlClassName } from '../utils/formatters';
import EmptyState from './EmptyState.jsx';
import PortfolioActionCenter from './PortfolioActionCenter.jsx';

function isProtected(position, order) {
  const protection = position.protection || {};
  return Boolean(
    protection.hasBracket ||
    (protection.hasStopLoss && protection.hasTakeProfit) ||
    (order?.orderClass === 'bracket' && order.stopLoss),
  );
}

export default function PositionsTable({ positions, openOrders, t }) {
  const orderBySymbol = new Map(openOrders.map((order) => [order.symbol, order]));
  const displayNumber = (value, masked) => (masked || value === null ? t.masked : value);
  const displayCurrency = (value, masked) => (masked || value === null ? t.masked : formatCurrency(value));

  return (
    <>
      <PortfolioActionCenter positions={positions} openOrders={openOrders} t={t} />

      <section className="panel positions-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.livePortfolio}</p>
            <h2>{t.positions}</h2>
          </div>
          <span className="pill">{positions.length} {t.activePositions}</span>
        </div>

        {positions.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title={t.noPositionsTitle}
            description={t.noPositionsDescription}
            testId="positions-empty-state"
          />
        ) : (
          <>
            <div className="table-wrap desktop-position-table">
              <table>
                <thead>
                  <tr>
                    <th>{t.symbol}</th>
                    <th>{t.bucket}</th>
                    <th>{t.qty}</th>
                    <th>{t.avg}</th>
                    <th>{t.current}</th>
                    <th>{t.pnl}</th>
                    <th>{t.protection}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const order = orderBySymbol.get(position.symbol);
                    const masked = Boolean(position.valuesMasked);
                    const protectedPosition = isProtected(position, order);
                    return (
                      <tr key={position.symbol}>
                        <td className="symbol">{position.symbol}</td>
                        <td><span className="bucket">{position.bucket}</span></td>
                        <td>{displayNumber(position.quantity, masked)}</td>
                        <td>{displayCurrency(position.averageCost, masked)}</td>
                        <td>{displayCurrency(position.currentPrice, masked)}</td>
                        <td className={masked ? 'neutral' : pnlClassName(position.unrealizedPnL)}>{displayCurrency(position.unrealizedPnL, masked)}</td>
                        <td>{protectedPosition ? <span className="status good">{t.protected}</span> : <span className="status warn">{t.needsReview}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-position-list" aria-label={t.positions}>
              {positions.map((position) => {
                const order = orderBySymbol.get(position.symbol);
                const masked = Boolean(position.valuesMasked);
                const protectedPosition = isProtected(position, order);
                return (
                  <article className="position-card" key={position.symbol} data-testid={`position-card-${position.symbol}`}>
                    <div className="position-card-heading">
                      <div>
                        <strong className="symbol">{position.symbol}</strong>
                        <span className="bucket">{position.bucket}</span>
                      </div>
                      <strong className={masked ? 'neutral' : pnlClassName(position.unrealizedPnL)}>
                        {displayCurrency(position.unrealizedPnL, masked)}
                      </strong>
                    </div>

                    <dl className="position-card-metrics">
                      <div><dt>{t.qty}</dt><dd>{displayNumber(position.quantity, masked)}</dd></div>
                      <div><dt>{t.avg}</dt><dd>{displayCurrency(position.averageCost, masked)}</dd></div>
                      <div><dt>{t.current}</dt><dd>{displayCurrency(position.currentPrice, masked)}</dd></div>
                      <div><dt>{t.marketValue}</dt><dd>{displayCurrency(position.marketValue, masked)}</dd></div>
                    </dl>

                    <div className={`position-protection ${protectedPosition ? 'protected' : 'review'}`}>
                      <span>{t.protection}</span>
                      <strong>{protectedPosition ? t.protected : t.needsReview}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <p className="hint">{t.positionsHint}</p>
      </section>
    </>
  );
}
