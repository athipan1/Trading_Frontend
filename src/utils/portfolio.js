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

function safeSpreadsheetText(value) {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(cell) {
  const value = cell.type === 'Number' && Number.isFinite(Number(cell.value))
    ? String(cell.value)
    : safeSpreadsheetText(cell.value);
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
    return [
      { value: safeSpreadsheetText(position.symbol), type: 'String' },
      { value: safeSpreadsheetText(position.bucket), type: 'String' },
      financialValue(position.quantity),
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
  const headerCells = headers.map((value) => ({ value, type: 'String' }));

  if (format === 'excel') {
    const rowXml = (cells) => `<Row>${cells.map((cell) => (
      `<Cell><Data ss:Type="${cell.type}">${escapeXml(cell.value)}</Data></Cell>`
    )).join('')}</Row>`;
    return {
      content: `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>\n`
        + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" `
        + `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
        + `<Worksheet ss:Name="Portfolio"><Table>${rowXml(headerCells)}`
        + `${rows.map(rowXml).join('')}</Table></Worksheet></Workbook>`,
      extension: 'xls',
      mimeType: 'application/vnd.ms-excel;charset=utf-8',
    };
  }

  return {
    content: `\uFEFF${[headerCells, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`,
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8',
  };
}
