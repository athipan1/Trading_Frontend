import { describe, expect, it } from 'vitest';
import { createPortfolioExport, derivePortfolioWorkspace, positionOwnership, summarizePositionOwnership } from './portfolio.js';

const positions = [
  { symbol: 'MSFT', bucket: 'growth', marketValue: 300, unrealizedPnL: 30 },
  {
    symbol: 'AAPL',
    bucket: 'value',
    marketValue: 700,
    unrealizedPnL: -5,
    protection: { hasBracket: true },
  },
  { symbol: 'AMD', bucket: 'growth', marketValue: 200, unrealizedPnL: 10 },
];

describe('portfolio workspace model', () => {
  it('keeps unknown ownership quarantined even for positions with strategy names', () => {
    const rows = [
      { symbol: 'OXY', bucket: 'unassigned', ownership: 'manual' },
      { symbol: 'MSFT', bucket: 'quality_growth', ownership: 'ai_managed' },
      { symbol: 'NVDA', bucket: 'quality_growth' },
      { symbol: 'XYZ', ownership: 'external_unverified' },
    ];
    expect(summarizePositionOwnership(rows)).toEqual({ manual: 1, ai_managed: 1, unclassified: 2 });
    expect(positionOwnership(rows[2])).toBe('unclassified');
    expect(derivePortfolioWorkspace({
      positions: rows, openOrders: [], ownership: 'manual',
    }).positions.map((row) => row.symbol)).toEqual(['OXY']);
    expect(derivePortfolioWorkspace({
      positions: rows, openOrders: [], ownership: 'ai_managed',
    }).positions.map((row) => row.symbol)).toEqual(['MSFT']);
    expect(derivePortfolioWorkspace({
      positions: rows, openOrders: [], ownership: 'unclassified',
    }).positions.map((row) => row.symbol)).toEqual(['NVDA', 'XYZ']);
  });

  it('searches, filters protection, sorts, and clamps pagination', () => {
    const result = derivePortfolioWorkspace({
      positions,
      openOrders: [],
      bucket: 'value',
      protection: 'protected',
      sort: 'market-value',
      page: 99,
      pageSize: 1,
    });

    expect(result.positions.map((position) => position.symbol)).toEqual(['AAPL']);
    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.buckets).toEqual(['growth', 'value']);
  });

  it('filters by strategy bucket without leaking value-based ordering when masked', () => {
    const result = derivePortfolioWorkspace({
      positions,
      openOrders: [],
      bucket: 'growth',
      sort: 'market-value',
      valuesMasked: true,
    });

    expect(result.positions.map((position) => position.symbol)).toEqual(['MSFT', 'AMD']);
    expect(result.positions.every((position) => position.valuesMasked)).toBe(true);
    expect(result.buckets).toEqual(['growth', 'value']);
  });

  it('does not reveal globally masked values through numeric sorting', () => {
    const result = derivePortfolioWorkspace({
      positions,
      openOrders: [],
      sort: 'market-value',
      valuesMasked: true,
    });

    expect(result.positions.map((position) => position.symbol)).toEqual(['MSFT', 'AAPL', 'AMD']);
    expect(result.positions.every((position) => position.valuesMasked)).toBe(true);
  });

  it('sorts numeric values descending and paginates deterministically', () => {
    const result = derivePortfolioWorkspace({
      positions,
      openOrders: [],
      sort: 'pnl',
      page: 2,
      pageSize: 2,
    });

    expect(result.positions.map((position) => position.symbol)).toEqual(['AAPL']);
    expect(result.pageCount).toBe(2);
  });

  it('masks financial exports and neutralizes spreadsheet formulas', () => {
    const exported = createPortfolioExport({
      positions: [{
        symbol: '=HYPERLINK("bad")',
        bucket: '@unsafe',
        quantity: 9,
        averageCost: 10,
        currentPrice: 11,
        marketValue: 99,
        unrealizedPnL: 9,
        valuesMasked: true,
      }],
      openOrders: [],
      format: 'csv',
      labels: {
        symbol: 'Symbol', bucket: 'Bucket', quantity: 'Qty', averageCost: 'Avg',
        currentPrice: 'Current', marketValue: 'Market value', pnl: 'P/L',
        protection: 'Protection', masked: 'Masked', protected: 'Protected',
        needsReview: 'Needs review',
      },
    });

    expect(exported.content).toContain("'=HYPERLINK(");
    expect(exported.content).toContain("'@unsafe");
    expect(exported.content).not.toContain(',"9",');
    expect(exported.content.match(/Masked/g)).toHaveLength(5);
  });

  it('masks only quantity in exports when position size privacy is enabled', () => {
    const exported = createPortfolioExport({
      positions: [{
        symbol: 'ACGL',
        bucket: 'value',
        quantity: 9,
        averageCost: 10,
        currentPrice: 11,
        marketValue: 99,
        unrealizedPnL: 9,
        quantityMasked: true,
      }],
      openOrders: [],
      format: 'csv',
      labels: {
        symbol: 'Symbol', bucket: 'Bucket', quantity: 'Qty', averageCost: 'Avg',
        currentPrice: 'Current', marketValue: 'Market value', pnl: 'P/L',
        protection: 'Protection', masked: 'Masked', protected: 'Protected',
        needsReview: 'Needs review',
      },
    });

    expect(exported.content.match(/Masked/g)).toHaveLength(1);
    expect(exported.content).toContain('99');
    expect(exported.content).not.toContain(',9,10,');
  });

  it('creates a typed SpreadsheetML workbook for Excel exports', () => {
    const exported = createPortfolioExport({
      positions: [positions[0]],
      openOrders: [],
      format: 'excel',
      labels: {
        symbol: 'Symbol', bucket: 'Bucket', quantity: 'Qty', averageCost: 'Avg',
        currentPrice: 'Current', marketValue: 'Market value', pnl: 'P/L',
        protection: 'Protection', masked: 'Masked', protected: 'Protected',
        needsReview: 'Needs review',
      },
    });

    expect(exported.extension).toBe('xls');
    expect(exported.content).toContain('xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"');
    expect(exported.content).toContain('<Data ss:Type="Number">300</Data>');
    expect(exported.content).toContain('<Data ss:Type="String">MSFT</Data>');
  });
});
