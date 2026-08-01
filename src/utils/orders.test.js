import { describe, expect, it } from 'vitest';
import {
  createOrdersExport,
  deriveOrdersWorkspace,
  orderStatusGroup,
  orderTimelineEvents,
} from './orders.js';

const orders = [
  { symbol: 'MSFT', side: 'buy', status: 'filled', type: 'market', orderClass: 'simple' },
  { symbol: 'ACGL', side: 'sell', status: 'new', type: 'limit', orderClass: 'bracket' },
  { symbol: 'AMD', side: 'buy', status: 'rejected', type: 'limit', orderClass: 'simple' },
  { symbol: 'NVDA', side: 'sell', status: 'canceled', type: 'stop', orderClass: 'simple' },
  { symbol: 'META', side: 'buy', status: 'vendor_new_state', type: 'limit', orderClass: 'simple' },
];

describe('orders workspace model', () => {
  it.each([
    ['pending_new', 'pending'],
    ['partially-filled', 'pending'],
    ['filled', 'filled'],
    ['rejected', 'rejected'],
    ['cancelled', 'cancelled'],
    ['vendor_new_state', 'other'],
  ])('classifies %s as %s', (status, category) => {
    expect(orderStatusGroup(status)).toBe(category);
  });

  it('searches, filters, sorts, counts, and clamps pagination', () => {
    const workspace = deriveOrdersWorkspace({
      orders,
      query: 'sell',
      status: 'cancelled',
      sort: 'symbol',
      page: 99,
      pageSize: 1,
    });

    expect(workspace.orders.map((order) => order.symbol)).toEqual(['NVDA']);
    expect(workspace.page).toBe(1);
    expect(workspace.counts).toEqual({
      all: 5, pending: 1, filled: 1, rejected: 1, cancelled: 1, other: 1,
    });
    expect(workspace.sides).toEqual(['buy', 'sell']);
  });

  it('masks exported financial cells and neutralizes formulas', () => {
    const exported = createOrdersExport({
      orders: [{
        ...orders[0],
        symbol: '=HYPERLINK("bad")',
        quantity: 12,
        takeProfit: 99,
        valuesMasked: true,
        statusGroup: 'filled',
        updatedAt: '2026-07-31T23:59:00Z',
      }],
      generatedAt: '2026-08-01T00:00:00Z',
      format: 'csv',
      labels: {
        symbol: 'Symbol', side: 'Side', quantity: 'Qty', type: 'Type', orderClass: 'Class',
        status: 'Status', category: 'Category', takeProfit: 'TP', stopLoss: 'SL',
        observedAt: 'Observed', masked: 'Masked', yes: 'Yes', no: 'No',
        statusGroups: { filled: 'Filled', other: 'Other' },
      },
    });

    expect(exported.content).toContain("'=HYPERLINK(");
    expect(exported.content.match(/Masked/g)).toHaveLength(2);
    expect(exported.content).not.toContain(',"12",');
    expect(exported.content).toContain('2026-08-01T00:00:00Z');
    expect(exported.content).not.toContain('2026-07-31T23:59:00Z');
  });

  it('creates a typed Excel export without executable spreadsheet formulas', () => {
    const exported = createOrdersExport({
      orders: [{
        ...orders[0],
        symbol: '+CMD',
        quantity: 12,
        takeProfit: 99,
        stopLoss: true,
        statusGroup: 'filled',
      }],
      generatedAt: '2026-08-01T00:00:00Z',
      format: 'excel',
      labels: {
        symbol: 'Symbol', side: 'Side', quantity: 'Qty', type: 'Type', orderClass: 'Class',
        status: 'Status', category: 'Category', takeProfit: 'TP', stopLoss: 'SL',
        observedAt: 'Observed', masked: 'Masked', yes: 'Yes', no: 'No',
        statusGroups: { filled: 'Filled', other: 'Other' },
      },
    });

    expect(exported).toMatchObject({ extension: 'xls', mimeType: expect.stringContaining('ms-excel') });
    expect(exported.content).toContain("&apos;+CMD");
    expect(exported.content).toContain('ss:Type="Number">12</Data>');
    expect(exported.content).not.toContain('<Formula');
  });

  it('builds an honest observation timeline from available timestamps', () => {
    expect(orderTimelineEvents({
      status: 'filled',
      submittedAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:01:00Z',
    }, '2026-08-01T00:02:00Z')).toEqual([
      { kind: 'submitted', at: '2026-08-01T00:00:00Z' },
      { kind: 'updated', at: '2026-08-01T00:01:00Z' },
      { kind: 'observed', at: '2026-08-01T00:02:00Z', status: 'filled', statusGroup: 'filled' },
    ]);
  });
});
