import { DATA_SOURCES } from '../config/dashboardConfig.js';
import { getDashboardRuntimeConfig } from '../config/runtimeConfig.js';
import { portfolioSnapshot } from '../data/mockPortfolio.js';

export const DASHBOARD_SCHEMA_VERSION = 'dashboard-snapshot.v2';
export const LEGACY_DASHBOARD_SCHEMA_VERSION = 'dashboard-snapshot.v1';
const REQUEST_TIMEOUT_MS = 10_000;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafeJson(value, path = 'root', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) throw new Error(`Malformed dashboard payload: ${path} contains a circular reference.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeJson(item, `${path}[${index}]`, seen));
    return;
  }
  if (!isPlainObject(value)) throw new Error(`Malformed dashboard payload: ${path} must be a plain object.`);
  Object.keys(value).forEach((key) => {
    if (DANGEROUS_KEYS.has(key)) throw new Error(`Malformed dashboard payload: unsafe key at ${path}.`);
    assertSafeJson(value[key], `${path}.${key}`, seen);
  });
}

function requiredObject(value, field) {
  if (!isPlainObject(value)) throw new Error(`Malformed dashboard payload: ${field} must be an object.`);
  return value;
}

function optionalObject(value) {
  return isPlainObject(value) ? value : {};
}

function requiredArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`Malformed dashboard payload: ${field} must be an array.`);
  return value;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function nullableNumber(value, field, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Malformed dashboard payload: ${field} must be finite.`);
  return parsed;
}

function boundedNullableNumber(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = nullableNumber(value, field);
  if (parsed === null) return null;
  if (parsed < min || parsed > max) {
    throw new Error(`Malformed dashboard payload: ${field} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function booleanValue(value) {
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  return Boolean(value);
}

function safeText(value, fallback = '', limit = 280) {
  if (value === undefined || value === null) return fallback;
  const printable = Array.from(String(value), (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, limit) || fallback;
}

function safeTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Malformed dashboard payload: timestamp is invalid.');
  return parsed.toISOString();
}

function normalizePosition(position, index) {
  const row = requiredObject(position, `positions[${index}]`);
  const protection = optionalObject(row.protection);
  return {
    symbol: safeText(firstValue(row.symbol, 'UNKNOWN'), 'UNKNOWN', 16),
    quantity: nullableNumber(firstValue(row.quantity, row.qty), `positions[${index}].quantity`),
    averageCost: nullableNumber(firstValue(row.averageCost, row.average_cost, row.avg_entry_price), `positions[${index}].averageCost`),
    currentPrice: nullableNumber(firstValue(row.currentPrice, row.current_market_price, row.current_price), `positions[${index}].currentPrice`),
    marketValue: nullableNumber(firstValue(row.marketValue, row.market_value), `positions[${index}].marketValue`),
    unrealizedPnL: nullableNumber(firstValue(row.unrealizedPnL, row.unrealized_pl), `positions[${index}].unrealizedPnL`),
    bucket: safeText(firstValue(row.bucket, row.strategy_bucket, 'unassigned'), 'unassigned', 48),
    valuesMasked: booleanValue(row.valuesMasked),
    protection: {
      status: safeText(firstValue(protection.status, 'unknown'), 'unknown', 48),
      hasStopLoss: booleanValue(firstValue(protection.hasStopLoss, row.hasStopLoss, false)),
      hasTakeProfit: booleanValue(firstValue(protection.hasTakeProfit, row.hasTakeProfit, false)),
      hasBracket: booleanValue(firstValue(protection.hasBracket, row.hasBracket, false)),
    },
  };
}

function normalizeOrder(order, index) {
  const row = requiredObject(order, `openOrders[${index}]`);
  const submittedAt = firstValue(row.submittedAt, row.submitted_at, row.createdAt, row.created_at);
  const updatedAt = firstValue(
    row.updatedAt,
    row.updated_at,
    row.filledAt,
    row.filled_at,
    row.canceledAt,
    row.canceled_at,
    row.cancelledAt,
    row.cancelled_at,
  );
  return {
    id: safeText(firstValue(
      row.id,
      row.orderId,
      row.order_id,
      row.clientOrderId,
      row.client_order_id,
    ), '', 96) || null,
    symbol: safeText(firstValue(row.symbol, 'UNKNOWN'), 'UNKNOWN', 16),
    side: safeText(firstValue(row.side, 'unknown'), 'unknown', 16),
    quantity: nullableNumber(firstValue(row.quantity, row.qty), `openOrders[${index}].quantity`),
    orderClass: safeText(firstValue(row.orderClass, row.order_class, 'unknown'), 'unknown', 32),
    type: safeText(firstValue(row.type, row.order_type, 'unknown'), 'unknown', 32),
    status: safeText(firstValue(row.status, row.broker_status, 'unknown'), 'unknown', 32),
    takeProfit: nullableNumber(firstValue(row.takeProfit, row.take_profit, row.limit_price, row.price), `openOrders[${index}].takeProfit`),
    stopLoss: booleanValue(firstValue(row.stopLoss, row.stop_loss, row.stop_price, row.order_class === 'bracket')),
    valuesMasked: booleanValue(row.valuesMasked),
    submittedAt: submittedAt ? safeTimestamp(submittedAt) : null,
    updatedAt: updatedAt ? safeTimestamp(updatedAt) : null,
  };
}

function normalizeSignal(signal, index) {
  const row = requiredObject(signal, `signals[${index}]`);
  return {
    symbol: safeText(firstValue(row.symbol, 'UNKNOWN'), 'UNKNOWN', 16),
    status: safeText(firstValue(row.status, row.execution_status, 'unknown'), 'unknown', 32),
    skill: safeText(firstValue(row.skill, row.skill_name, 'Signal'), 'Signal', 80),
    signal: safeText(firstValue(row.signal, row.reason, row.output?.signal, '-'), '-', 160),
    confidence: nullableNumber(firstValue(row.confidence, row.confidence_score, row.output?.confidence), `signals[${index}].confidence`, 0),
  };
}

function normalizeAgentTelemetry(agent, index) {
  const row = requiredObject(agent, `agents[${index}]`);
  const id = safeText(firstValue(row.id, row.agentId, row.agent_id, row.name), '', 64);
  if (!id) throw new Error(`Malformed dashboard payload: agents[${index}].id is required.`);
  const lastRunAt = firstValue(row.lastRunAt, row.last_run_at, row.lastRun, row.last_run);
  return {
    id,
    name: safeText(firstValue(row.name, id), id, 80),
    health: safeText(firstValue(row.health, 'unknown'), 'unknown', 32),
    status: safeText(firstValue(row.status, 'unknown'), 'unknown', 64),
    latencyMs: boundedNullableNumber(
      firstValue(row.latencyMs, row.latency_ms),
      `agents[${index}].latencyMs`,
      { max: 3_600_000 },
    ),
    version: safeText(row.version, '', 64) || null,
    cpuPercent: boundedNullableNumber(
      firstValue(row.cpuPercent, row.cpu_percent),
      `agents[${index}].cpuPercent`,
      { max: 100 },
    ),
    memoryPercent: boundedNullableNumber(
      firstValue(row.memoryPercent, row.memory_percent),
      `agents[${index}].memoryPercent`,
      { max: 100 },
    ),
    memoryMb: boundedNullableNumber(
      firstValue(row.memoryMb, row.memory_mb),
      `agents[${index}].memoryMb`,
      { max: 1_000_000 },
    ),
    lastRunAt: lastRunAt ? safeTimestamp(lastRunAt) : null,
  };
}

function freshnessFrom(data, generatedAt) {
  const source = optionalObject(data.freshness);
  const staleAfterMinutes = nullableNumber(source.staleAfterMinutes, 'freshness.staleAfterMinutes', 120);
  const expectedIntervalMinutes = nullableNumber(source.expectedIntervalMinutes, 'freshness.expectedIntervalMinutes', 60);
  const ageMinutes = generatedAt ? Math.max(0, (Date.now() - new Date(generatedAt).getTime()) / 60_000) : null;
  return {
    expectedIntervalMinutes,
    ageMinutes,
    isStale: ageMinutes === null ? true : ageMinutes > staleAfterMinutes,
    staleAfterMinutes,
  };
}

function normalizeV2(data) {
  const workflow = requiredObject(data.workflow, 'workflow');
  const runtime = requiredObject(data.runtime, 'runtime');
  const cycle = requiredObject(data.cycle, 'cycle');
  const account = requiredObject(data.account, 'account');
  const positions = requiredArray(data.positions, 'positions');
  const openOrders = requiredArray(data.openOrders, 'openOrders');
  const signals = requiredArray(data.signals, 'signals');
  const phases = requiredArray(data.phases, 'phases');
  const agents = data.agents === undefined ? [] : requiredArray(data.agents, 'agents');
  const generatedAt = safeTimestamp(data.generatedAt);
  const normalizedSignals = signals.map(normalizeSignal);
  const normalized = {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    sourceSchemaVersion: DASHBOARD_SCHEMA_VERSION,
    generatedAt,
    workflow: {
      runId: nullableNumber(workflow.runId, 'workflow.runId'),
      runNumber: nullableNumber(workflow.runNumber, 'workflow.runNumber'),
      runUrl: safeText(workflow.runUrl, '', 300) || null,
      eventName: safeText(workflow.eventName, 'unknown', 40),
      status: safeText(workflow.status, 'unknown', 32),
      conclusion: safeText(workflow.conclusion, 'unknown', 32),
      startedAt: workflow.startedAt ? safeTimestamp(workflow.startedAt) : null,
      completedAt: workflow.completedAt ? safeTimestamp(workflow.completedAt) : generatedAt,
      durationSeconds: nullableNumber(workflow.durationSeconds, 'workflow.durationSeconds'),
    },
    runtime: {
      mode: safeText(runtime.mode, 'UNKNOWN', 32),
      brokerMode: safeText(runtime.brokerMode, 'UNKNOWN', 32),
      dryRun: booleanValue(runtime.dryRun),
      liveTradingEnabled: booleanValue(runtime.liveTradingEnabled),
      flow: safeText(runtime.flow, 'hourly_portfolio_cycle', 64),
    },
    cycle: {
      id: safeText(cycle.id, '', 96) || null,
      status: safeText(cycle.status, 'unknown', 32),
      marketMode: safeText(cycle.marketMode, '', 64) || null,
      candidateCount: nullableNumber(cycle.candidateCount, 'cycle.candidateCount', 0),
      selectedSymbols: requiredArray(cycle.selectedSymbols, 'cycle.selectedSymbols').map((symbol) => safeText(symbol, '', 16)).filter(Boolean),
      executionAttempted: booleanValue(cycle.executionAttempted),
      executionStatus: safeText(cycle.executionStatus, 'unknown', 48),
      executionReason: safeText(cycle.executionReason, '', 200) || null,
      partialFillDetected: booleanValue(cycle.partialFillDetected),
    },
    phases: phases.map((phase, index) => {
      const row = requiredObject(phase, `phases[${index}]`);
      return {
        name: safeText(row.name, 'unknown', 48),
        status: safeText(row.status, 'unknown', 32),
        message: safeText(row.message, '', 280) || null,
      };
    }),
    agents: agents.map(normalizeAgentTelemetry),
    account: {
      cash: nullableNumber(account.cash, 'account.cash'),
      equity: nullableNumber(account.equity, 'account.equity'),
      buyingPower: nullableNumber(account.buyingPower, 'account.buyingPower'),
      status: safeText(account.status, 'UNKNOWN', 40),
      mode: safeText(runtime.mode, 'UNKNOWN', 32),
      lastSyncedAt: safeTimestamp(firstValue(account.lastSyncedAt, generatedAt)),
      valuesMasked: booleanValue(account.valuesMasked),
    },
    positions: positions.map(normalizePosition),
    openOrders: openOrders.map(normalizeOrder),
    signals: normalizedSignals,
    curatorSignals: normalizedSignals,
    warnings: requiredArray(data.warnings, 'warnings').map((warning) => safeText(warning, '', 280)).filter(Boolean),
    error: data.error === null ? null : (() => {
      const error = requiredObject(data.error, 'error');
      return { code: safeText(error.code, 'DASHBOARD_ERROR', 80), message: safeText(error.message, 'Dashboard snapshot reported an error.', 280) };
    })(),
    lastSuccessfulRun: data.lastSuccessfulRun === null ? null : (() => {
      const run = requiredObject(data.lastSuccessfulRun, 'lastSuccessfulRun');
      return {
        generatedAt: run.generatedAt ? safeTimestamp(run.generatedAt) : null,
        runId: nullableNumber(run.runId, 'lastSuccessfulRun.runId'),
        runNumber: nullableNumber(run.runNumber, 'lastSuccessfulRun.runNumber'),
        cycleStatus: safeText(run.cycleStatus, 'unknown', 32),
      };
    })(),
    summary: { ...optionalObject(data.summary) },
    privacy: {
      mode: safeText(optionalObject(data.privacy).mode, account.valuesMasked ? 'masked' : 'full', 24),
      valuesMasked: booleanValue(firstValue(optionalObject(data.privacy).valuesMasked, account.valuesMasked)),
    },
  };
  normalized.freshness = freshnessFrom(data, generatedAt);
  normalized.mode = normalized.runtime.mode;
  normalized.brokerMode = normalized.runtime.brokerMode;
  normalized.flow = normalized.runtime.flow;
  return normalized;
}

function normalizeV1(data) {
  if (import.meta.env?.DEV) console.warn('dashboard-snapshot.v1 is deprecated; migrate the publisher to dashboard-snapshot.v2.');
  const account = requiredObject(data.account, 'account');
  const positions = requiredArray(data.positions, 'positions');
  const openOrders = requiredArray(data.openOrders, 'openOrders');
  const signals = requiredArray(data.curatorSignals, 'curatorSignals');
  const generatedAt = safeTimestamp(firstValue(data.generatedAt, account.lastSyncedAt));
  const summary = optionalObject(data.summary);
  const normalizedSignals = signals.map(normalizeSignal);
  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    sourceSchemaVersion: LEGACY_DASHBOARD_SCHEMA_VERSION,
    generatedAt,
    workflow: { runId: null, runNumber: null, runUrl: null, eventName: 'unknown', status: 'unknown', conclusion: 'unknown', startedAt: null, completedAt: generatedAt, durationSeconds: null },
    runtime: { mode: safeText(firstValue(data.mode, account.mode, 'UNKNOWN'), 'UNKNOWN', 32), brokerMode: safeText(data.brokerMode, 'UNKNOWN', 32), dryRun: true, liveTradingEnabled: false, flow: safeText(data.flow, 'portfolio_review', 64) },
    cycle: { id: null, status: 'unknown', marketMode: null, candidateCount: nullableNumber(summary.candidateCount, 'summary.candidateCount', 0), selectedSymbols: [], executionAttempted: !['not_attempted', 'skipped', undefined, null].includes(summary.executionStatus), executionStatus: safeText(summary.executionStatus, 'unknown', 48), executionReason: safeText(summary.executionReason, '', 200) || null, partialFillDetected: false },
    phases: [], agents: [],
    account: { cash: nullableNumber(firstValue(account.cash, account.cash_balance), 'account.cash', 0), equity: nullableNumber(firstValue(account.equity, account.portfolio_value), 'account.equity', 0), buyingPower: nullableNumber(firstValue(account.buyingPower, account.buying_power), 'account.buyingPower', 0), status: safeText(account.status, 'UNKNOWN', 40), mode: safeText(firstValue(account.mode, data.mode, 'UNKNOWN'), 'UNKNOWN', 32), lastSyncedAt: safeTimestamp(firstValue(account.lastSyncedAt, account.last_synced_at, generatedAt)), valuesMasked: false },
    positions: positions.map(normalizePosition), openOrders: openOrders.map(normalizeOrder), signals: normalizedSignals, curatorSignals: normalizedSignals,
    warnings: [], error: null, lastSuccessfulRun: null, summary: { ...summary }, privacy: { mode: 'full', valuesMasked: false },
    freshness: freshnessFrom(data, generatedAt), mode: safeText(firstValue(data.mode, account.mode, 'UNKNOWN'), 'UNKNOWN', 32), brokerMode: safeText(data.brokerMode, 'UNKNOWN', 32), flow: safeText(data.flow, 'portfolio_review', 64),
  };
}

export function normalizeSnapshot(payload) {
  assertSafeJson(payload);
  const data = requiredObject(payload, 'root');
  if (data.schemaVersion === DASHBOARD_SCHEMA_VERSION) return normalizeV2(data);
  if (data.schemaVersion === LEGACY_DASHBOARD_SCHEMA_VERSION) return normalizeV1(data);
  throw new Error(`Unsupported dashboard schema: received ${safeText(data.schemaVersion, '(missing)', 64)}.`);
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function cacheBustedUrl(snapshotUrl) {
  const url = new URL(snapshotUrl);
  url.searchParams.set('t', String(Date.now()));
  return url.toString();
}

async function fetchJson(fetchImpl, url, { signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Dashboard request failed with HTTP ${response.status}.`);
    try {
      return await response.json();
    } catch {
      throw new Error('Dashboard response is not valid JSON.');
    }
  } catch (error) {
    if (controller.signal.aborted) {
      if (timedOut) throw new Error('Dashboard request timed out.');
      const cancelled = new Error('Dashboard request was cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function createDashboardClient(config, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function' && config.dataSource !== DATA_SOURCES.MOCK) throw new Error('A fetch implementation is required for remote dashboard data.');
  return Object.freeze({
    dataSource: config.dataSource,
    async getSnapshot({ signal } = {}) {
      if (config.dataSource === DATA_SOURCES.MOCK) return normalizeSnapshot(portfolioSnapshot);
      const url = config.dataSource === DATA_SOURCES.PUBLIC_SNAPSHOT ? cacheBustedUrl(config.snapshotUrl) : joinUrl(config.managerApiUrl, '/dashboard/snapshot');
      return normalizeSnapshot(await fetchJson(fetchImpl, url, { signal }));
    },
  });
}

let defaultClient;
function getDefaultClient() {
  if (!defaultClient) defaultClient = createDashboardClient(getDashboardRuntimeConfig());
  return defaultClient;
}
export async function getDashboardSnapshot(options) { return getDefaultClient().getSnapshot(options); }
export function getDashboardDataSource() { return getDefaultClient().dataSource; }
