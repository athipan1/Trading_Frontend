import { createTabularExport, safeSpreadsheetText } from './spreadsheet.js';

export const PORTFOLIO_PAGE_SIZE = 8;

export function isPositionProtected(position, order) {
  const protection = position?.protection || {};
  return Boolean(
    protection.hasBracket
    || (protection.hasStopLoss && protection.hasTakeProfit)
    || (order?.orderClass === 'bracket' && order.stopLoss),
  );
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function derivePortfolioWorkspace({
  positions,
  openOrders,
  query = '',
  bucket = 'all',
  protection = 'all',
  sort = 'symbol',
  page = 1,
  pageSize = PORTFOLIO_PAGE_SIZE,
  valuesMasked = false,
}) {
  const orderBySymbol = new Map(openOrders.map((order) => [order.symbol, order]));
  const normalizedQuery = String(query).trim().toLocaleUpperCase();
  const normalizedBucket = String(bucket).trim().toLocaleLowerCase();
  const records = positions.map((position, index) => ({
    ...position,
    valuesMasked: valuesMasked || Boolean(position.valuesMasked),
    protected: isPositionProtected(position, orderBySymbol.get(position.symbol)),
    sourceIndex: index,
  }));
  const filtered = records.filter((position) => {
    const matchesQuery = !normalizedQuery
      || `${position.symbol} ${position.bucket}`.toLocaleUpperCase().includes(normalizedQuery);
    const matchesBucket = normalizedBucket === 'all'
      || String(position.bucket).toLocaleLowerCase() === normalizedBucket;
    const matchesProtection = protection === 'all'
      || (protection === 'protected' ? position.protected : !position.protected);
    return matchesQuery && matchesBucket && matchesProtection;
  });
  const sorted = [...filtered].sort((left, right) => {
    if (left.valuesMasked || right.valuesMasked) {
      if (left.valuesMasked !== right.valuesMasked) return left.valuesMasked ? 1 : -1;
      return left.sourceIndex - right.sourceIndex;
    }
    if (sort === 'market-value') {
      return Math.abs(finiteNumber(right.marketValue)) - Math.abs(finiteNumber(left.marketValue))
        || left.sourceIndex - right.sourceIndex;
    }
    if (sort === 'pnl') {
      return finiteNumber(right.unrealizedPnL) - finiteNumber(left.unrealizedPnL)
        || left.sourceIndex - right.sourceIndex;
    }
    return String(left.symbol).localeCompare(String(right.symbol)) || left.sourceIndex - right.sourceIndex;
  });
  const safePageSize = Math.max(1, Math.trunc(finiteNumber(pageSize)) || PORTFOLIO_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const safePage = Math.min(pageCount, Math.max(1, Math.trunc(finiteNumber(page)) || 1));
  const start = (safePage - 1) * safePageSize;

  return {
    allPositions: sorted,
    buckets: [...new Set(positions.map((position) => position.bucket).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    page: safePage,
    pageCount,
    positions: sorted.slice(start, start + safePageSize),
    totalCount: sorted.length,
  };
}

export function createPortfolioExport({
  positions,
  openOrders,
  format,
  labels,
  valuesMasked = false,
}) {
  const orderBySymbol = new Map(openOrders.map((order) => [order.symbol, order]));
  const headers = [
    labels.symbol,
    labels.bucket,
    labels.quantity,
    labels.averageCost,
    labels.currentPrice,
    labels.marketValue,
    labels.pnl,
    labels.protection,
  ];
  const rows = positions.map((position) => {
    const masked = valuesMasked || Boolean(position.valuesMasked);
    const financialValue = (value) => (
      masked || value === null
        ? { value: labels.masked, type: 'String' }
        : { value, type: 'Number' }
    );
    const quantityValue = masked || position.quantityMasked || position.quantity === null
      ? { value: labels.masked, type: 'String' }
      : { value: position.quantity, type: 'Number' };
    return [
      { value: safeSpreadsheetText(position.symbol), type: 'String' },
      { value: safeSpreadsheetText(position.bucket), type: 'String' },
      quantityValue,
      financialValue(position.averageCost),
      financialValue(position.currentPrice),
      financialValue(position.marketValue),
      financialValue(position.unrealizedPnL),
      {
        value: isPositionProtected(position, orderBySymbol.get(position.symbol))
          ? labels.protected
          : labels.needsReview,
        type: 'String',
      },
    ];
  });
  return createTabularExport({ format, sheetName: 'Portfolio', headers, rows });
}
