import { createTabularExport, safeSpreadsheetText } from './spreadsheet.js';

export const ORDER_PAGE_SIZE = 10;

const STATUS_GROUPS = Object.freeze({
  pending: new Set([
    'accepted', 'accepted_for_bidding', 'active', 'calculated', 'held', 'new', 'open',
    'partially_filled', 'pending_cancel', 'pending_new', 'pending_replace', 'working',
  ]),
  filled: new Set(['filled']),
  rejected: new Set(['rejected', 'suspended']),
  cancelled: new Set([
    'canceled', 'cancelled', 'done_for_day', 'expired', 'replaced', 'stopped',
  ]),
});

const STATUS_RANK = Object.freeze({ pending: 0, rejected: 1, cancelled: 2, filled: 3, other: 4 });

function normalizedStatus(value) {
  return String(value || 'unknown').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export function orderStatusGroup(status) {
  const normalized = normalizedStatus(status);
  return Object.entries(STATUS_GROUPS).find(([, values]) => values.has(normalized))?.[0] || 'other';
}

function finitePage(value, fallback) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function deriveOrdersWorkspace({
  orders,
  query = '',
  status = 'all',
  side = 'all',
  sort = 'status',
  page = 1,
  pageSize = ORDER_PAGE_SIZE,
  valuesMasked = false,
}) {
  const normalizedQuery = String(query).trim().toLocaleUpperCase();
  const normalizedSide = String(side).trim().toLocaleLowerCase();
  const records = orders.map((order, sourceIndex) => ({
    ...order,
    sourceIndex,
    statusGroup: orderStatusGroup(order.status),
    valuesMasked: valuesMasked || Boolean(order.valuesMasked),
  }));
  const counts = records.reduce((summary, order) => {
    summary.all += 1;
    summary[order.statusGroup] += 1;
    return summary;
  }, { all: 0, pending: 0, filled: 0, rejected: 0, cancelled: 0, other: 0 });
  const sides = [...new Set(records.map((order) => String(order.side).toLocaleLowerCase()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const filtered = records.filter((order) => {
    const searchable = [order.symbol, order.side, order.type, order.orderClass, order.status]
      .join(' ')
      .toLocaleUpperCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (status === 'all' || order.statusGroup === status)
      && (normalizedSide === 'all' || String(order.side).toLocaleLowerCase() === normalizedSide);
  });
  const sorted = [...filtered].sort((left, right) => {
    if (sort === 'symbol') {
      return String(left.symbol).localeCompare(String(right.symbol)) || left.sourceIndex - right.sourceIndex;
    }
    if (sort === 'side') {
      return String(left.side).localeCompare(String(right.side))
        || String(left.symbol).localeCompare(String(right.symbol))
        || left.sourceIndex - right.sourceIndex;
    }
    return STATUS_RANK[left.statusGroup] - STATUS_RANK[right.statusGroup]
      || String(left.status).localeCompare(String(right.status))
      || left.sourceIndex - right.sourceIndex;
  });
  const safePageSize = finitePage(pageSize, ORDER_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const safePage = Math.min(pageCount, finitePage(page, 1));
  const start = (safePage - 1) * safePageSize;

  return {
    allOrders: sorted,
    counts,
    orders: sorted.slice(start, start + safePageSize),
    page: safePage,
    pageCount,
    sides,
    totalCount: sorted.length,
  };
}

export function createOrdersExport({ orders, generatedAt, format, labels, valuesMasked = false }) {
  const headers = [
    labels.symbol,
    labels.side,
    labels.quantity,
    labels.type,
    labels.orderClass,
    labels.status,
    labels.category,
    labels.takeProfit,
    labels.stopLoss,
    labels.observedAt,
  ];
  const rows = orders.map((order) => {
    const masked = valuesMasked || Boolean(order.valuesMasked);
    const financialCell = (value) => (
      masked || value === null
        ? { value: labels.masked, type: 'String' }
        : { value, type: 'Number' }
    );
    return [
      { value: safeSpreadsheetText(order.symbol), type: 'String' },
      { value: safeSpreadsheetText(order.side), type: 'String' },
      financialCell(order.quantity),
      { value: safeSpreadsheetText(order.type), type: 'String' },
      { value: safeSpreadsheetText(order.orderClass), type: 'String' },
      { value: safeSpreadsheetText(order.status), type: 'String' },
      { value: labels.statusGroups[order.statusGroup] ?? labels.statusGroups.other, type: 'String' },
      financialCell(order.takeProfit),
      { value: order.stopLoss ? labels.yes : labels.no, type: 'String' },
      { value: generatedAt || '', type: 'String' },
    ];
  });
  return createTabularExport({ format, sheetName: 'Orders', headers, rows });
}

export function orderTimelineEvents(order, generatedAt) {
  const events = [];
  if (order.submittedAt) events.push({ kind: 'submitted', at: order.submittedAt });
  if (order.updatedAt && order.updatedAt !== order.submittedAt) {
    events.push({ kind: 'updated', at: order.updatedAt });
  }
  events.push({
    kind: 'observed',
    at: generatedAt,
    status: order.status,
    statusGroup: order.statusGroup ?? orderStatusGroup(order.status),
  });
  return events.filter((event) => event.at);
}
