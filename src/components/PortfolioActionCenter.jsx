import { CheckCircle2, ShieldAlert, TriangleAlert } from 'lucide-react';

function protectedSymbols(positions, openOrders) {
  const bracketSymbols = new Set(
    openOrders
      .filter((order) => order.orderClass === 'bracket' && order.stopLoss)
      .map((order) => order.symbol),
  );

  return positions.filter((position) => {
    const protection = position.protection || {};
    return !(
      protection.hasBracket ||
      (protection.hasStopLoss && protection.hasTakeProfit) ||
      bracketSymbols.has(position.symbol)
    );
  });
}

export default function PortfolioActionCenter({ positions, openOrders, t }) {
  const unprotectedPositions = protectedSymbols(positions, openOrders);
  const ordersWithoutStop = openOrders.filter((order) => !order.stopLoss);
  const actionCount = unprotectedPositions.length + ordersWithoutStop.length;

  if (actionCount === 0) {
    return (
      <section className="portfolio-action-center clear" aria-labelledby="portfolio-action-center-title" data-testid="portfolio-action-center">
        <div className="action-center-heading">
          <div className="action-center-icon clear" aria-hidden="true"><CheckCircle2 /></div>
          <div>
            <p className="eyebrow">{t.actionCenter}</p>
            <h2 id="portfolio-action-center-title">{t.actionCenterClear}</h2>
            <p>{t.actionCenterClearDescription}</p>
          </div>
        </div>
        <span className="status good">{t.noActionRequired}</span>
      </section>
    );
  }

  return (
    <section className="portfolio-action-center attention" aria-labelledby="portfolio-action-center-title" data-testid="portfolio-action-center">
      <div className="action-center-heading">
        <div className="action-center-icon attention" aria-hidden="true"><ShieldAlert /></div>
        <div>
          <p className="eyebrow">{t.actionCenter}</p>
          <h2 id="portfolio-action-center-title">{t.actionCenterNeedsReview}</h2>
          <p>{t.actionCenterDescription}</p>
        </div>
      </div>

      <span className="status warn">{actionCount} {t.itemsNeedReview}</span>

      <div className="action-center-list">
        {unprotectedPositions.length ? (
          <article className="action-center-item warning">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>{t.positionProtectionReview}</strong>
              <p>{t.positionProtectionReviewDescription} <b>{unprotectedPositions.map((position) => position.symbol).join(', ')}</b></p>
            </div>
          </article>
        ) : null}

        {ordersWithoutStop.length ? (
          <article className="action-center-item warning">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>{t.orderStopReview}</strong>
              <p>{t.orderStopReviewDescription} <b>{ordersWithoutStop.map((order) => order.symbol).join(', ')}</b></p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
