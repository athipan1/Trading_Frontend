import { describe, expect, it } from 'vitest';
import { createPortfolioExport, derivePortfolioWorkspace } from './portfolio.js';

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
