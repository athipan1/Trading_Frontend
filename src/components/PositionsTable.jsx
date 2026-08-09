import { BriefcaseBusiness } from 'lucide-react';
import { isPositionProtected } from '../utils/portfolio.js';
import { formatCurrency, pnlClassName } from '../utils/formatters.js';
import EmptyState from './EmptyState.jsx';
import PortfolioActionCenter from './PortfolioActionCenter.jsx';

function PositionCards({ positions, orderBySymbol, t, onViewDetails, className = '' }) {
  return (
    <div className={className} aria-label={t.positions} data-testid="position-card-view">
      {positions.map((position) => {
        const order = orderBySymbol.get(position.symbol);
        const masked = Boolean(position.valuesMasked);
        const quantityMasked = masked || Boolean(position.quantityMasked);
        const protectedPosition = isPositionProtected(position, order);
        const displayNumber = (value) => (quantityMasked || value === null ? t.masked : value);
        const displayCurrency = (value) => (
          masked || value === null ? t.masked : formatCurrency(value)
        );
        return (
          <article
            className="position-card"
            key={position.symbol}
            data-testid={`position-card-${position.symbol}`}
          >
            <div className="position-card-heading">
              <div>
                <strong className="symbol">{position.symbol}</strong>
                <span className="bucket">{position.bucket}</span>
              </div>
              <strong className={masked ? 'neutral' : pnlClassName(position.unrealizedPnL)}>
                {displayCurrency(position.unrealizedPnL)}
              </strong>
            </div>

            <dl className="position-card-metrics">
              <div><dt>{t.qty}</dt><dd>{displayNumber(position.quantity)}</dd></div>
              <div><dt>{t.avg}</dt><dd>{displayCurrency(position.averageCost)}</dd></div>
              <div><dt>{t.current}</dt><dd>{displayCurrency(position.currentPrice)}</dd></div>
              <div><dt>{t.marketValue}</dt><dd>{displayCurrency(position.marketValue)}</dd></div>
            </dl>

            <div className={`position-protection ${protectedPosition ? 'protected' : 'review'}`}>
              <span>{t.protection}</span>
              <strong>{protectedPosition ? t.protected : t.needsReview}</strong>
            </div>
            {onViewDetails ? (
              <button
                className="position-detail-button"
                type="button"
                onClick={() => onViewDetails(position)}
                aria-label={`${t.viewPositionDetails}: ${position.symbol}`}
              >
                {t.viewDetails}
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PositionTableView({ positions, orderBySymbol, t, onViewDetails, className = '' }) {
  return (
    <div
      className={`table-wrap ${className}`}
      role="region"
      aria-label={`${t.positions} ${t.livePortfolio}`}
      tabIndex={0}
      data-testid="position-table-view"
    >
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
            {onViewDetails ? <th><span className="sr-only">{t.positionActions}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const order = orderBySymbol.get(position.symbol);
            const masked = Boolean(position.valuesMasked);
            const quantityMasked = masked || Boolean(position.quantityMasked);
            const protectedPosition = isPositionProtected(position, order);
            const displayNumber = (value) => (quantityMasked || value === null ? t.masked : value);
            const displayCurrency = (value) => (
              masked || value === null ? t.masked : formatCurrency(value)
            );
            return (
              <tr key={position.symbol}>
                <td className="symbol">{position.symbol}</td>
                <td><span className="bucket">{position.bucket}</span></td>
                <td>{displayNumber(position.quantity)}</td>
                <td>{displayCurrency(position.averageCost)}</td>
                <td>{displayCurrency(position.currentPrice)}</td>
                <td className={masked ? 'neutral' : pnlClassName(position.unrealizedPnL)}>
                  {displayCurrency(position.unrealizedPnL)}
                </td>
                <td>
                  {protectedPosition
                    ? <span className="status good">{t.protected}</span>
                    : <span className="status warn">{t.needsReview}</span>}
                </td>
                {onViewDetails ? (
                  <td>
                    <button
                      className="table-detail-button"
                      type="button"
                      onClick={() => onViewDetails(position)}
                      aria-label={`${t.viewPositionDetails}: ${position.symbol}`}
                    >
                      {t.viewDetails}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PositionsTable({
  positions,
  openOrders,
  t,
  showActionCenter = true,
  viewMode = 'responsive',
  totalCount = positions.length,
  emptyTitle = t.noPositionsTitle,
  emptyDescription = t.noPositionsDescription,
  onViewDetails,
}) {
  const orderBySymbol = new Map(openOrders.map((order) => [order.symbol, order]));
  const showTable = viewMode === 'responsive' || viewMode === 'table';
  const showCards = viewMode === 'responsive' || viewMode === 'cards';

  return (
    <>
      {showActionCenter ? (
        <PortfolioActionCenter positions={positions} openOrders={openOrders} t={t} />
      ) : null}

      <section className="panel positions-panel portfolio-workspace">
        <div className="section-heading portfolio-workspace-heading">
          <div>
            <p className="eyebrow">{t.livePortfolio}</p>
            <h2>{t.positions}</h2>
          </div>
          <span className="pill">{totalCount} {t.activePositions}</span>
        </div>

        {positions.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title={emptyTitle}
            description={emptyDescription}
            testId={totalCount === 0 && emptyTitle === t.noPositionsTitle
              ? 'positions-empty-state'
              : 'positions-filter-empty-state'}
          />
        ) : (
          <>
            {showTable ? (
              <PositionTableView
                positions={positions}
                orderBySymbol={orderBySymbol}
                t={t}
                onViewDetails={onViewDetails}
                className={viewMode === 'responsive'
                  ? 'desktop-position-table'
                  : 'position-table-view'}
              />
            ) : null}
            {showCards ? (
              <PositionCards
                positions={positions}
                orderBySymbol={orderBySymbol}
                t={t}
                onViewDetails={onViewDetails}
                className={viewMode === 'responsive'
                  ? 'mobile-position-list'
                  : 'position-card-view'}
              />
            ) : null}
          </>
        )}

        <p className="hint">{t.positionsHint}</p>
      </section>
    </>
  );
}
