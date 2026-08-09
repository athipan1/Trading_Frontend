import { ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatCurrency, pnlClassName } from '../../utils/formatters.js';
import { isPositionProtected } from '../../utils/portfolio.js';

export default function PositionDetailDrawer({ position, order, t, onClose }) {
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const masked = Boolean(position.valuesMasked);
  const quantityMasked = masked || Boolean(position.quantityMasked);
  const protectedPosition = isPositionProtected(position, order);
  const displayNumber = (value) => (quantityMasked || value === null ? t.masked : value);
  const displayCurrency = (value) => (
    masked || value === null ? t.masked : formatCurrency(value)
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    };
  }, [onClose, position.symbol]);

  return (
    <div className="position-detail-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="position-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        data-testid="position-detail-drawer"
      >
        <div className="position-detail-heading">
          <div>
            <p className="eyebrow">{t.positionDetails}</p>
            <h2 id="position-detail-title">{position.symbol}</h2>
            <span className="bucket">{position.bucket}</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.closeDetails}>
            <X aria-hidden="true" />
          </button>
        </div>

        {masked ? <p className="position-detail-privacy">{t.maskedPositionNotice}</p> : null}

        <dl className="position-detail-metrics">
          <div><dt>{t.qty}</dt><dd>{displayNumber(position.quantity)}</dd></div>
          <div><dt>{t.avg}</dt><dd>{displayCurrency(position.averageCost)}</dd></div>
          <div><dt>{t.current}</dt><dd>{displayCurrency(position.currentPrice)}</dd></div>
          <div><dt>{t.marketValue}</dt><dd>{displayCurrency(position.marketValue)}</dd></div>
          <div className="wide">
            <dt>{t.unrealizedPnl}</dt>
            <dd className={masked ? 'neutral' : pnlClassName(position.unrealizedPnL)}>
              {displayCurrency(position.unrealizedPnL)}
            </dd>
          </div>
        </dl>

        <div className={`position-detail-protection ${protectedPosition ? 'protected' : 'review'}`}>
          {protectedPosition
            ? <ShieldCheck aria-hidden="true" />
            : <TriangleAlert aria-hidden="true" />}
          <div>
            <span>{t.protection}</span>
            <strong>{protectedPosition ? t.protected : t.needsReview}</strong>
          </div>
        </div>

        <section className="position-detail-order" aria-label={t.relatedOrder}>
          <h3>{t.relatedOrder}</h3>
          {order ? (
            <dl>
              <div><dt>{t.orderSide}</dt><dd>{order.side}</dd></div>
              <div><dt>{t.orderType}</dt><dd>{order.type}</dd></div>
              <div><dt>{t.orderClass}</dt><dd>{order.orderClass}</dd></div>
              <div><dt>{t.takeProfit}</dt><dd>{displayCurrency(order.takeProfit)}</dd></div>
            </dl>
          ) : <p>{t.noRelatedOrder}</p>}
        </section>
      </section>
    </div>
  );
}
