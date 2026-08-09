import { DATA_SOURCES } from '../../config/dashboardConfig.js';
import { getDashboardRuntimeConfig } from '../../config/runtimeConfig.js';

export const OBSERVABILITY_SCHEMA_VERSION = 'trading-observability.v1';
export const DECISION_HISTORY_SCHEMA_VERSION = 'decision-history.v1';
export const OBSERVABILITY_STAGE_ORDER = Object.freeze([
  'scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution',
]);

const ALLOWED_STAGE_STATUSES = new Set([
  'success', 'warning', 'blocked', 'skipped', 'not_attempted', 'failure', 'unknown',
]);
const ALLOWED_CANDIDATE_STATUSES = new Set([
  'blocked', 'not_selected', 'eligible', 'backtest_passed', 'approved', 'executed', 'unknown',
]);
const MAX_CANDIDATES = 10;
const MAX_HISTORY_CYCLES = 24;
const MAX_REASON_CODES = 8;
const REQUEST_TIMEOUT_MS = 10_000;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function object(value, field) {
  if (!isPlainObject(value)) throw new Error(`Malformed observability payload: ${field} must be an object.`);
  return value;
}

function text(value, fallback = '', limit = 160) {
  if (value === undefined || value === null) return fallback;
  const printable = Array.from(String(value), (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, limit) || fallback;
}

function nullableNumber(value, field, { min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Malformed observability payload: ${field} is out of range.`);
  }
  return parsed;
}

function timestamp(value, field) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Malformed observability payload: ${field} is invalid.`);
  return parsed.toISOString();
}

function reasonCodes(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_REASON_CODES) {
    throw new Error(`Malformed observability payload: ${field} must contain at most ${MAX_REASON_CODES} items.`);
  }
  return value.map((item) => text(item, '', 96)).filter(Boolean);
}

function normalizeStage(value, index, fieldPrefix = 'stages') {
  const row = object(value, `${fieldPrefix}[${index}]`);
  const id = text(row.id, '', 48);
  const status = text(row.status, 'unknown', 32);
  if (id !== OBSERVABILITY_STAGE_ORDER[index]) {
    throw new Error(`Malformed observability payload: ${fieldPrefix}[${index}].id must be ${OBSERVABILITY_STAGE_ORDER[index]}.`);
  }
  if (!ALLOWED_STAGE_STATUSES.has(status)) {
    throw new Error(`Malformed observability payload: ${fieldPrefix}[${index}].status is unsupported.`);
  }
  return {
    id,
    status,
    reasonCodes: reasonCodes(row.reasonCodes, `${fieldPrefix}[${index}].reasonCodes`),
    observedAt: timestamp(row.observedAt, `${fieldPrefix}[${index}].observedAt`),
    summary: isPlainObject(row.summary) ? { ...row.summary } : {},
  };
}

function normalizeRefs(value, field) {
  if (value === undefined || value === null) return { decisionId: null, positionId: null };
  const row = object(value, field);
  return {
    decisionId: text(row.decisionId, '', 96) || null,
    positionId: text(row.positionId, '', 96) || null,
  };
}

function normalizeCandidate(value, index, fieldPrefix = 'candidates', { allowRefs = false } = {}) {
  const row = object(value, `${fieldPrefix}[${index}]`);
  const status = text(row.status, 'unknown', 32);
  const stageReached = text(row.stageReached, '', 48) || null;
  if (!ALLOWED_CANDIDATE_STATUSES.has(status)) {
    throw new Error(`Malformed observability payload: ${fieldPrefix}[${index}].status is unsupported.`);
  }
  if (stageReached !== null && !OBSERVABILITY_STAGE_ORDER.includes(stageReached)) {
    throw new Error(`Malformed observability payload: ${fieldPrefix}[${index}].stageReached is unsupported.`);
  }
  const candidate = {
    symbol: text(row.symbol, 'UNKNOWN', 16),
    rank: nullableNumber(row.rank, `${fieldPrefix}[${index}].rank`, { min: 1, max: 10_000 }),
    verdict: text(row.verdict, 'unknown', 32),
    finalScore: nullableNumber(row.finalScore, `${fieldPrefix}[${index}].finalScore`, { min: 0, max: 1 }),
    strategyBucket: text(row.strategyBucket, 'unassigned', 64),
    status,
    stageReached,
    reasonCodes: reasonCodes(row.reasonCodes, `${fieldPrefix}[${index}].reasonCodes`),
  };
  return allowRefs
    ? { ...candidate, refs: normalizeRefs(row.refs, `${fieldPrefix}[${index}].refs`) }
    : candidate;
}

function normalizeCycle(value, field) {
  if (value === null || value === undefined) return null;
  const row = object(value, field);
  const stages = row.stages;
  const candidates = row.candidates;
  if (!Array.isArray(stages) || stages.length !== OBSERVABILITY_STAGE_ORDER.length) {
    throw new Error(`Malformed observability payload: ${field}.stages must contain exactly 7 stages.`);
  }
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) {
    throw new Error(`Malformed observability payload: ${field}.candidates must contain at most ${MAX_CANDIDATES} items.`);
  }
  const source = text(row.source, 'unknown', 32);
  if (!['hourly_artifact', 'workflow_metadata'].includes(source)) {
    throw new Error(`Malformed observability payload: ${field}.source is unsupported.`);
  }
  return {
    source,
    flowKind: text(row.flowKind, 'decision_path', 32),
    correlationId: text(row.correlationId, '', 96) || null,
    cycleId: text(row.cycleId, '', 96) || null,
    workflowRunId: nullableNumber(row.workflowRunId, `${field}.workflowRunId`, { min: 1, max: 1e15 }),
    observedAt: timestamp(row.observedAt, `${field}.observedAt`),
    status: text(row.status, 'unknown', 32),
    reasonCode: text(row.reasonCode, '', 96) || null,
    stages: stages.map((stage, index) => normalizeStage(stage, index, `${field}.stages`)),
    candidates: candidates.map((candidate, index) => normalizeCandidate(candidate, index, `${field}.candidates`)),
  };
}

function normalizeHistorySummary(value, field) {
  const row = object(value ?? {}, field);
  return {
    candidateCount: nullableNumber(row.candidateCount ?? 0, `${field}.candidateCount`, { min: 0, max: MAX_CANDIDATES }),
    buyCount: nullableNumber(row.buyCount ?? 0, `${field}.buyCount`, { min: 0, max: MAX_CANDIDATES }),
    blockedCount: nullableNumber(row.blockedCount ?? 0, `${field}.blockedCount`, { min: 0, max: MAX_CANDIDATES }),
    executedCount: nullableNumber(row.executedCount ?? 0, `${field}.executedCount`, { min: 0, max: MAX_CANDIDATES }),
    riskRejectedCount: nullableNumber(row.riskRejectedCount ?? 0, `${field}.riskRejectedCount`, { min: 0, max: MAX_CANDIDATES }),
    executionFailureCount: nullableNumber(row.executionFailureCount ?? 0, `${field}.executionFailureCount`, { min: 0, max: MAX_CANDIDATES }),
  };
}

function normalizeHistoryCycle(value, index) {
  const field = `decisionHistory.cycles[${index}]`;
  const row = object(value, field);
  const stages = row.stages;
  const candidates = row.candidates;
  if (!Array.isArray(stages) || stages.length !== OBSERVABILITY_STAGE_ORDER.length) {
    throw new Error(`Malformed observability payload: ${field}.stages must contain exactly 7 stages.`);
  }
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) {
    throw new Error(`Malformed observability payload: ${field}.candidates must contain at most ${MAX_CANDIDATES} items.`);
  }
  return {
    source: text(row.source, 'unknown', 32),
    flowKind: text(row.flowKind, 'decision_path', 32),
    correlationId: text(row.correlationId, '', 96) || null,
    cycleId: text(row.cycleId, '', 96) || null,
    workflowRunId: nullableNumber(row.workflowRunId, `${field}.workflowRunId`, { min: 1, max: 1e15 }),
    observedAt: timestamp(row.observedAt, `${field}.observedAt`),
    status: text(row.status, 'unknown', 32),
    reasonCode: text(row.reasonCode, '', 96) || null,
    summary: normalizeHistorySummary(row.summary, `${field}.summary`),
    stages: stages.map((stage, stageIndex) => normalizeStage(stage, stageIndex, `${field}.stages`)),
    candidates: candidates.map((candidate, candidateIndex) => normalizeCandidate(
      candidate,
      candidateIndex,
      `${field}.candidates`,
      { allowRefs: true },
    )),
  };
}

export function normalizeTradingObservability(value) {
  if (value === undefined || value === null) return null;
  const root = object(value, 'observability');
  if (root.schemaVersion !== OBSERVABILITY_SCHEMA_VERSION) {
    throw new Error(`Unsupported observability schema: ${text(root.schemaVersion, '(missing)', 64)}.`);
  }
  return {
    schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
    current: normalizeCycle(root.current, 'observability.current'),
    lastMeaningful: normalizeCycle(root.lastMeaningful, 'observability.lastMeaningful'),
  };
}

export function normalizeDecisionHistory(value) {
  if (value === undefined || value === null) return null;
  const root = object(value, 'decisionHistory');
  if (root.schemaVersion !== DECISION_HISTORY_SCHEMA_VERSION) {
    throw new Error(`Unsupported decision history schema: ${text(root.schemaVersion, '(missing)', 64)}.`);
  }
  if (root.retentionCycles !== MAX_HISTORY_CYCLES) {
    throw new Error(`Malformed observability payload: decisionHistory.retentionCycles must be ${MAX_HISTORY_CYCLES}.`);
  }
  if (!Array.isArray(root.cycles) || root.cycles.length > MAX_HISTORY_CYCLES) {
    throw new Error(`Malformed observability payload: decisionHistory.cycles must contain at most ${MAX_HISTORY_CYCLES} items.`);
  }
  return {
    schemaVersion: DECISION_HISTORY_SCHEMA_VERSION,
    generatedAt: timestamp(root.generatedAt, 'decisionHistory.generatedAt'),
    retentionCycles: MAX_HISTORY_CYCLES,
    cycles: root.cycles.map(normalizeHistoryCycle),
  };
}

function targetUrl(config) {
  if (config.dataSource === DATA_SOURCES.PUBLIC_SNAPSHOT) {
    const url = new URL(config.snapshotUrl);
    url.searchParams.set('observability', String(Date.now()));
    return url.toString();
  }
  if (config.dataSource === DATA_SOURCES.MANAGER_API) {
    return `${config.managerApiUrl.replace(/\/$/, '')}/dashboard/snapshot`;
  }
  return null;
}

export async function getTradingDecisionData({ fetchImpl = globalThis.fetch, signal } = {}) {
  const config = getDashboardRuntimeConfig();
  const url = targetUrl(config);
  if (!url) return { observability: null, decisionHistory: null };
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for trading observability.');

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Observability request failed with HTTP ${response.status}.`);
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Observability response is not valid JSON.');
    }
    return {
      observability: normalizeTradingObservability(payload.observability),
      decisionHistory: normalizeDecisionHistory(payload.decisionHistory),
    };
  } catch (error) {
    if (controller.signal.aborted) {
      if (timedOut) throw new Error('Observability request timed out.');
      const cancelled = new Error('Observability request was cancelled.');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function getTradingObservability(options = {}) {
  const result = await getTradingDecisionData(options);
  return result.observability;
}
