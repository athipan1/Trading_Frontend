import { portfolioSnapshot } from '../data/mockPortfolio';

const API_BASE_URL = import.meta.env.VITE_MANAGER_API_URL;
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

function cleanBaseUrl(baseUrl) {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeSnapshot(payload) {
  const data = payload?.data ?? payload ?? {};
  const account = data.account ?? data.broker?.account ?? portfolioSnapshot.account;
  const positions = data.positions ?? data.broker?.positions ?? portfolioSnapshot.positions;
  const openOrders = data.openOrders ?? data.open_orders ?? data.broker?.open_orders ?? portfolioSnapshot.openOrders;
  const curatorSignals = data.curatorSignals ?? data.curator_signals ?? data.signals ?? portfolioSnapshot.curatorSignals;

  return {
    account: {
      cash: Number(firstValue(account.cash, account.cash_balance, portfolioSnapshot.account.cash)),
      equity: Number(firstValue(account.equity, account.portfolio_value, portfolioSnapshot.account.equity)),
      buyingPower: Number(firstValue(account.buyingPower, account.buying_power, portfolioSnapshot.account.buyingPower)),
      status: firstValue(account.status, portfolioSnapshot.account.status),
      mode: firstValue(account.mode, account.trading_mode, account.paper ? 'PAPER' : null, portfolioSnapshot.account.mode),
      lastSyncedAt: firstValue(account.lastSyncedAt, account.last_synced_at, account.broker_synced_at, data.timestamp, portfolioSnapshot.account.lastSyncedAt),
    },
    positions: positions.map((position) => ({
      symbol: position.symbol,
      quantity: Number(firstValue(position.quantity, position.qty, 0)),
      averageCost: Number(firstValue(position.averageCost, position.average_cost, position.avg_entry_price, 0)),
      currentPrice: Number(firstValue(position.currentPrice, position.current_market_price, position.current_price, 0)),
      marketValue: Number(firstValue(position.marketValue, position.market_value, 0)),
      unrealizedPnL: Number(firstValue(position.unrealizedPnL, position.unrealized_pl, 0)),
      bucket: firstValue(position.bucket, position.strategy_bucket, 'unassigned'),
    })),
    openOrders: openOrders.map((order) => ({
      symbol: order.symbol,
      side: order.side,
      quantity: Number(firstValue(order.quantity, order.qty, 0)),
      orderClass: firstValue(order.orderClass, order.order_class, 'unknown'),
      type: firstValue(order.type, order.order_type, 'unknown'),
      status: firstValue(order.status, order.broker_status, 'unknown'),
      takeProfit: Number(firstValue(order.takeProfit, order.take_profit, order.limit_price, order.price, 0)),
      stopLoss: Boolean(firstValue(order.stopLoss, order.stop_loss, order.stop_price, order.order_class === 'bracket')),
    })),
    curatorSignals: curatorSignals.map((signal) => ({
      symbol: signal.symbol,
      status: firstValue(signal.status, signal.execution_status, 'unknown'),
      skill: firstValue(signal.skill, signal.skill_name, 'Curator Signal'),
      signal: firstValue(signal.signal, signal.reason, signal.output?.signal, '-'),
      confidence: Number(firstValue(signal.confidence, signal.confidence_score, signal.output?.confidence, 0)),
    })),
  };
}

export async function getDashboardSnapshot() {
  if (USE_MOCK_DATA || !API_BASE_URL) {
    return normalizeSnapshot(portfolioSnapshot);
  }

  const response = await fetch(`${cleanBaseUrl(API_BASE_URL)}/dashboard/snapshot`);
  if (!response.ok) {
    throw new Error(`Dashboard snapshot request failed: ${response.status}`);
  }
  return normalizeSnapshot(await response.json());
}

export function isMockDataMode() {
  return USE_MOCK_DATA || !API_BASE_URL;
}
