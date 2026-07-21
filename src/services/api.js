import { DATA_SOURCES } from '../config/dashboardConfig.js';
import { getDashboardRuntimeConfig } from '../config/runtimeConfig.js';
import { portfolioSnapshot } from '../data/mockPortfolio.js';

export const DASHBOARD_SCHEMA_VERSION = 'dashboard-snapshot.v1';
const REQUEST_TIMEOUT_MS = 10_000;

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Malformed dashboard payload: ${field} must be an object.`);
  }
  return value;
}

function requiredArray(value, field) {
  if (!Array.isArray(value)) {
    throw new Error(`Malformed dashboard payload: ${field} must be an array.`);
  }
  return value;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function numberValue(value, field, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Malformed dashboard payload: ${field} must be numeric.`);
  }
  return parsed;
}

function booleanValue(value) {
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  return Boolean(value);
}

export function normalizeSnapshot(payload) {
  const data = requiredObject(payload, 'root');
  if (data.schemaVersion !== DASHBOARD_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported dashboard schema: expected ${DASHBOARD_SCHEMA_VERSION}, received ${data.schemaVersion || '(missing)'}.`,
    );
  }

  const account = requiredObject(data.account, 'account');
  const positions = requiredArray(data.positions, 'positions');
  const openOrders = requiredArray(data.openOrders, 'openOrders');
  const curatorSignals = requiredArray(data.curatorSignals, 'curatorSignals');

  return {
    schemaVersion: data.schemaVersion,
    generatedAt: firstValue(data.generatedAt, account.lastSyncedAt, null),
    mode: firstValue(data.mode, account.mode, 'UNKNOWN'),
    brokerMode: firstValue(data.brokerMode, 'UNKNOWN'),
    flow: firstValue(data.flow, 'portfolio_review'),
    account: {
      cash: numberValue(firstValue(account.cash, account.cash_balance), 'account.cash'),
      equity: numberValue(firstValue(account.equity, account.portfolio_value), 'account.equity'),
      buyingPower: numberValue(firstValue(account.buyingPower, account.buying_power), 'account.buyingPower'),
      status: firstValue(account.status, 'UNKNOWN'),
      mode: firstValue(account.mode, data.mode, 'UNKNOWN'),
      lastSyncedAt: firstValue(account.lastSyncedAt, account.last_synced_at, data.generatedAt, null),
    },
    positions: positions.map((position, index) => {
      const row = requiredObject(position, `positions[${index}]`);
      const protection = row.protection && typeof row.protection === 'object' ? row.protection : {};
      return {
        symbol: String(firstValue(row.symbol, 'UNKNOWN')),
        quantity: numberValue(firstValue(row.quantity, row.qty), `positions[${index}].quantity`),
        averageCost: numberValue(
          firstValue(row.averageCost, row.average_cost, row.avg_entry_price),
          `positions[${index}].averageCost`,
        ),
        currentPrice: numberValue(
          firstValue(row.currentPrice, row.current_market_price, row.current_price),
          `positions[${index}].currentPrice`,
        ),
        marketValue: numberValue(firstValue(row.marketValue, row.market_value), `positions[${index}].marketValue`),
        unrealizedPnL: numberValue(
          firstValue(row.unrealizedPnL, row.unrealized_pl),
          `positions[${index}].unrealizedPnL`,
        ),
        bucket: String(firstValue(row.bucket, row.strategy_bucket, 'unassigned')),
        protection: {
          status: firstValue(protection.status, 'unknown'),
          hasStopLoss: booleanValue(firstValue(protection.hasStopLoss, row.hasStopLoss, false)),
          hasTakeProfit: booleanValue(firstValue(protection.hasTakeProfit, row.hasTakeProfit, false)),
          hasBracket: booleanValue(firstValue(protection.hasBracket, row.hasBracket, false)),
        },
      };
    }),
    openOrders: openOrders.map((order, index) => {
      const row = requiredObject(order, `openOrders[${index}]`);
      return {
        symbol: String(firstValue(row.symbol, 'UNKNOWN')),
        side: String(firstValue(row.side, 'unknown')),
        quantity: numberValue(firstValue(row.quantity, row.qty), `openOrders[${index}].quantity`),
        orderClass: String(firstValue(row.orderClass, row.order_class, 'unknown')),
        type: String(firstValue(row.type, row.order_type, 'unknown')),
        status: String(firstValue(row.status, row.broker_status, 'unknown')),
        takeProfit: numberValue(
          firstValue(row.takeProfit, row.take_profit, row.limit_price, row.price),
          `openOrders[${index}].takeProfit`,
        ),
        stopLoss: booleanValue(
          firstValue(row.stopLoss, row.stop_loss, row.stop_price, row.order_class === 'bracket'),
        ),
      };
    }),
    curatorSignals: curatorSignals.map((signal, index) => {
      const row = requiredObject(signal, `curatorSignals[${index}]`);
      return {
        symbol: String(firstValue(row.symbol, 'UNKNOWN')),
        status: String(firstValue(row.status, row.execution_status, 'unknown')),
        skill: String(firstValue(row.skill, row.skill_name, 'Curator Signal')),
        signal: String(firstValue(row.signal, row.reason, row.output?.signal, '-')),
        confidence: numberValue(
          firstValue(row.confidence, row.confidence_score, row.output?.confidence),
          `curatorSignals[${index}].confidence`,
        ),
      };
    }),
    summary: data.summary && typeof data.summary === 'object' ? { ...data.summary } : {},
  };
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function fetchJson(fetchImpl, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Dashboard request failed with HTTP ${response.status}.`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error('Dashboard response is not valid JSON.');
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function createDashboardClient(config, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function' && config.dataSource !== DATA_SOURCES.MOCK) {
    throw new Error('A fetch implementation is required for remote dashboard data.');
  }

  return Object.freeze({
    dataSource: config.dataSource,
    async getSnapshot() {
      if (config.dataSource === DATA_SOURCES.MOCK) {
        return normalizeSnapshot(portfolioSnapshot);
      }
      const url = config.dataSource === DATA_SOURCES.PUBLIC_SNAPSHOT
        ? config.snapshotUrl
        : joinUrl(config.managerApiUrl, '/dashboard/snapshot');
      return normalizeSnapshot(await fetchJson(fetchImpl, url));
    },
  });
}

let defaultClient;

function getDefaultClient() {
  if (!defaultClient) defaultClient = createDashboardClient(getDashboardRuntimeConfig());
  return defaultClient;
}

export async function getDashboardSnapshot() {
  return getDefaultClient().getSnapshot();
}

export function getDashboardDataSource() {
  return getDefaultClient().dataSource;
}
