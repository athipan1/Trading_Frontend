import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';

const EXPECTED_SCHEMA = 'dashboard-snapshot.v2';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_MAX_AGE_MINUTES = 180;
const DEFAULT_FRESHNESS_POLICY = 'warn';
const ALLOWED_FRESHNESS_POLICIES = new Set(['fail', 'warn']);
const ALLOWED_PRIVACY_MODES = new Set(['masked', 'status-only']);
const ALLOWED_CONCLUSIONS = new Set([
  'success',
  'failure',
  'cancelled',
  'skipped',
  'timed_out',
  'action_required',
  'neutral',
]);
const FORBIDDEN_KEY_PATTERN =
  /^(?:api[_-]?key|secret|password|token|authorization|database[_-]?url|internal[_-]?url|service[_-]?url|agent[_-]?url|broker[_-]?order[_-]?id|client[_-]?order[_-]?id|order[_-]?id)$/i;
const FORBIDDEN_VALUE_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~-]{20,}\b/i,
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requirePlainObject(value, path) {
  if (!isPlainObject(value)) throw new Error(`${path} must be an object`);
  return value;
}

function requireFiniteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function validateOptionalAgentTelemetry(agents) {
  if (agents === undefined) return 0;
  if (!Array.isArray(agents)) throw new Error('agents must be an array');
  agents.forEach((agent, index) => {
    const row = requirePlainObject(agent, `agents[${index}]`);
    requireString(row.id ?? row.agentId ?? row.agent_id ?? row.name, `agents[${index}].id`);
    const boundedMetrics = [
      ['latencyMs', row.latencyMs ?? row.latency_ms, 3_600_000],
      ['cpuPercent', row.cpuPercent ?? row.cpu_percent, 100],
      ['memoryPercent', row.memoryPercent ?? row.memory_percent, 100],
      ['memoryMb', row.memoryMb ?? row.memory_mb, 1_000_000],
    ];
    boundedMetrics.forEach(([name, value, max]) => {
      if (value === undefined || value === null) return;
      const metric = requireFiniteNumber(value, `agents[${index}].${name}`);
      if (metric < 0 || metric > max) {
        throw new Error(`agents[${index}].${name} must be between 0 and ${max}`);
      }
    });
    const lastRunAt = row.lastRunAt ?? row.last_run_at ?? row.lastRun ?? row.last_run;
    if (lastRunAt !== undefined && lastRunAt !== null) {
      parseTimestamp(lastRunAt, `agents[${index}].lastRunAt`);
    }
  });
  return agents.length;
}

function validateBoundedOptionalMetric(value, path, { min = 0, max }) {
  if (value === undefined || value === null) return;
  const metric = requireFiniteNumber(value, path);
  if (metric < min || metric > max) {
    throw new Error(`${path} must be between ${min} and ${max}`);
  }
}

function validateOptionalRiskTelemetry(risk) {
  if (risk === undefined || risk === null) return false;
  const row = requirePlainObject(risk, 'risk');
  validateBoundedOptionalMetric(row.riskScore ?? row.risk_score, 'risk.riskScore', { max: 100 });
  validateBoundedOptionalMetric(
    row.grossExposurePercent ?? row.gross_exposure_percent,
    'risk.grossExposurePercent',
    { max: 1_000 },
  );
  validateBoundedOptionalMetric(
    row.netExposurePercent ?? row.net_exposure_percent,
    'risk.netExposurePercent',
    { min: -1_000, max: 1_000 },
  );
  validateBoundedOptionalMetric(
    row.drawdownPercent ?? row.drawdown_percent,
    'risk.drawdownPercent',
    { max: 100 },
  );

  const limits = row.limits;
  if (limits !== undefined && limits !== null) {
    const limitRow = requirePlainObject(limits, 'risk.limits');
    validateBoundedOptionalMetric(
      limitRow.grossExposurePercent ?? limitRow.gross_exposure_percent,
      'risk.limits.grossExposurePercent',
      { max: 1_000 },
    );
    validateBoundedOptionalMetric(
      limitRow.drawdownPercent ?? limitRow.drawdown_percent,
      'risk.limits.drawdownPercent',
      { max: 100 },
    );
  }

  const allocations = row.sectorAllocation ?? row.sector_allocation;
  if (allocations !== undefined && allocations !== null) {
    if (!Array.isArray(allocations)) throw new Error('risk.sectorAllocation must be an array');
    allocations.forEach((allocation, index) => {
      const item = requirePlainObject(allocation, `risk.sectorAllocation[${index}]`);
      requireString(item.sector ?? item.name, `risk.sectorAllocation[${index}].sector`);
      validateBoundedOptionalMetric(
        item.percent ?? item.percentage ?? item.sharePercent ?? item.share_percent,
        `risk.sectorAllocation[${index}].percent`,
        { max: 100 },
      );
      validateBoundedOptionalMetric(
        item.marketValue ?? item.market_value,
        `risk.sectorAllocation[${index}].marketValue`,
        { max: 1_000_000_000_000 },
      );
    });
  }

  const halt = row.emergencyHalt ?? row.emergency_halt;
  if (halt !== undefined && halt !== null) {
    const haltRow = requirePlainObject(halt, 'risk.emergencyHalt');
    requireBoolean(haltRow.active, 'risk.emergencyHalt.active');
    const updatedAt = haltRow.updatedAt ?? haltRow.updated_at;
    if (updatedAt !== undefined && updatedAt !== null) {
      parseTimestamp(updatedAt, 'risk.emergencyHalt.updatedAt');
    }
  }
  return true;
}

function parseTimestamp(value, path) {
  const text = requireString(value, path);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${path} must be an ISO-8601 timestamp`);
  }
  return timestamp;
}

function walkForSecrets(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new Error(`Forbidden sensitive field detected at ${childPath}`);
    }
    walkForSecrets(child, childPath);
  }
}

function parseFreshnessPolicy(value = DEFAULT_FRESHNESS_POLICY) {
  const policy = String(value || DEFAULT_FRESHNESS_POLICY).trim().toLowerCase();
  if (!ALLOWED_FRESHNESS_POLICIES.has(policy)) {
    throw new Error('freshnessPolicy must be fail or warn');
  }
  return policy;
}

export function validateEndpointUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('Snapshot URL must use HTTPS');
  if (url.username || url.password) {
    throw new Error('Snapshot URL must not contain credentials');
  }
  if (url.search || url.hash) {
    throw new Error('Snapshot URL must not contain query parameters or fragments');
  }
  if (url.hostname !== 'raw.githubusercontent.com') {
    throw new Error('Snapshot URL must use raw.githubusercontent.com');
  }
  if (
    url.pathname !==
    '/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json'
  ) {
    throw new Error(
      'Snapshot URL must point to the approved Manager_Agent dashboard snapshot',
    );
  }
  return url;
}

export function validateSnapshot(snapshot, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMinutes = options.maxAgeMinutes ?? DEFAULT_MAX_AGE_MINUTES;
  const freshnessPolicy = parseFreshnessPolicy(options.freshnessPolicy ?? 'fail');
  const root = requirePlainObject(snapshot, '$');
  if (root.schemaVersion !== EXPECTED_SCHEMA) {
    throw new Error(`schemaVersion must be ${EXPECTED_SCHEMA}`);
  }

  const generatedAtMs = parseTimestamp(root.generatedAt, 'generatedAt');
  if ((generatedAtMs - nowMs) / 60_000 > 5) {
    throw new Error('generatedAt is too far in the future');
  }
  const ageMinutes = Math.max(0, (nowMs - generatedAtMs) / 60_000);
  const freshnessWarnings = [];
  if (ageMinutes > maxAgeMinutes) {
    freshnessWarnings.push(
      `Manager snapshot is stale: ${ageMinutes.toFixed(1)} minutes old (limit ${maxAgeMinutes})`,
    );
  }

  const workflow = requirePlainObject(root.workflow, 'workflow');
  if (!Number.isInteger(workflow.runId) || workflow.runId <= 0) {
    throw new Error('workflow.runId must be a positive integer');
  }
  if (!Number.isInteger(workflow.runNumber) || workflow.runNumber <= 0) {
    throw new Error('workflow.runNumber must be a positive integer');
  }
  const runUrl = new URL(requireString(workflow.runUrl, 'workflow.runUrl'));
  if (
    runUrl.protocol !== 'https:' ||
    runUrl.hostname !== 'github.com' ||
    !/^\/athipan1\/Manager_Agent\/actions\/runs\/\d+$/.test(runUrl.pathname)
  ) {
    throw new Error('workflow.runUrl must point to a Manager_Agent GitHub Actions run');
  }
  if (workflow.status !== 'completed') {
    throw new Error('workflow.status must be completed for a published snapshot');
  }
  if (!ALLOWED_CONCLUSIONS.has(workflow.conclusion)) {
    throw new Error(`workflow.conclusion is unsupported: ${String(workflow.conclusion)}`);
  }

  const runtime = requirePlainObject(root.runtime, 'runtime');
  if (requireBoolean(runtime.liveTradingEnabled, 'runtime.liveTradingEnabled') !== false) {
    throw new Error('Unsafe snapshot: runtime.liveTradingEnabled must be false');
  }
  requirePlainObject(root.cycle, 'cycle');
  requirePlainObject(root.summary, 'summary');
  if (!Array.isArray(root.positions)) throw new Error('positions must be an array');
  if (!Array.isArray(root.openOrders)) throw new Error('openOrders must be an array');
  const agentTelemetryCount = validateOptionalAgentTelemetry(root.agents);
  const riskTelemetryPublished = validateOptionalRiskTelemetry(root.risk);

  const freshness = requirePlainObject(root.freshness, 'freshness');
  requireFiniteNumber(
    freshness.expectedIntervalMinutes,
    'freshness.expectedIntervalMinutes',
  );
  const staleAfterMinutes = requireFiniteNumber(
    freshness.staleAfterMinutes,
    'freshness.staleAfterMinutes',
  );
  const publisherMarkedStale = requireBoolean(
    freshness.isStale,
    'freshness.isStale',
  );
  if (publisherMarkedStale) {
    freshnessWarnings.push('Manager snapshot reports freshness.isStale=true');
  }

  const privacy = requirePlainObject(root.privacy, 'privacy');
  if (!ALLOWED_PRIVACY_MODES.has(privacy.mode)) {
    throw new Error('privacy.mode must be masked or status-only');
  }
  if (requireBoolean(privacy.valuesMasked, 'privacy.valuesMasked') !== true) {
    throw new Error('privacy.valuesMasked must be true');
  }

  walkForSecrets(root);
  const serialized = JSON.stringify(root);
  for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(`Potential secret value detected by pattern ${pattern}`);
    }
  }

  const uniqueFreshnessWarnings = [...new Set(freshnessWarnings)];
  if (uniqueFreshnessWarnings.length > 0 && freshnessPolicy === 'fail') {
    throw new Error(uniqueFreshnessWarnings.join('; '));
  }

  return {
    schemaVersion: root.schemaVersion,
    generatedAt: root.generatedAt,
    ageMinutes: Number(ageMinutes.toFixed(1)),
    workflow: {
      runId: workflow.runId,
      runNumber: workflow.runNumber,
      runUrl: workflow.runUrl,
      conclusion: workflow.conclusion,
    },
    runtime: {
      mode: typeof runtime.mode === 'string' ? runtime.mode : null,
      brokerMode: typeof runtime.brokerMode === 'string' ? runtime.brokerMode : null,
      liveTradingEnabled: runtime.liveTradingEnabled,
    },
    privacy: { mode: privacy.mode, valuesMasked: privacy.valuesMasked },
    agentTelemetryCount,
    riskTelemetryPublished,
    freshness: {
      policy: freshnessPolicy,
      isStale: uniqueFreshnessWarnings.length > 0,
      staleAfterMinutes,
      warnings: uniqueFreshnessWarnings,
    },
    warnings: uniqueFreshnessWarnings,
  };
}

async function fetchWithRetry(url, { timeoutMs, retries }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain;q=0.9',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Trading_Frontend-Manager-Connection-Check/1.0',
        },
      });
      if (response.status !== 200) {
        throw new Error(`Manager snapshot returned HTTP ${response.status}`);
      }
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error(`Manager snapshot exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      const corsAllowOrigin = response.headers.get('access-control-allow-origin');
      if (corsAllowOrigin !== '*') {
        throw new Error(
          'Manager snapshot must allow browser access with Access-Control-Allow-Origin: *',
        );
      }
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new Error(`Manager snapshot exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new Error('Manager snapshot response is not valid JSON');
      }
      return {
        payload,
        attempts: attempt,
        httpStatus: response.status,
        latencyMs: Date.now() - startedAt,
        corsAllowOrigin,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('Manager snapshot request failed');
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export async function runConnectionCheck(options = {}) {
  const url = validateEndpointUrl(options.url ?? DEFAULT_SNAPSHOT_URL);
  const timeoutMs = parsePositiveInteger(
    options.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    'timeoutMs',
  );
  const retries = parsePositiveInteger(options.retries, DEFAULT_RETRIES, 'retries');
  const maxAgeMinutes = parsePositiveInteger(
    options.maxAgeMinutes,
    DEFAULT_MAX_AGE_MINUTES,
    'maxAgeMinutes',
  );
  const freshnessPolicy = parseFreshnessPolicy(
    options.freshnessPolicy ?? DEFAULT_FRESHNESS_POLICY,
  );
  const checkedAt = new Date().toISOString();
  try {
    const fetched = await fetchWithRetry(url, { timeoutMs, retries });
    const validation = validateSnapshot(fetched.payload, {
      maxAgeMinutes,
      freshnessPolicy,
    });
    return {
      connected: true,
      checkedAt,
      endpoint: url.toString(),
      attempts: fetched.attempts,
      httpStatus: fetched.httpStatus,
      latencyMs: fetched.latencyMs,
      corsAllowOrigin: fetched.corsAllowOrigin,
      ...validation,
      errors: [],
    };
  } catch (error) {
    return {
      connected: false,
      checkedAt,
      endpoint: url.toString(),
      freshness: { policy: freshnessPolicy, isStale: null, warnings: [] },
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function getArgument(name) {
  const prefix = `--${name}=`;
  const item = process.argv.find((argument) => argument.startsWith(prefix));
  return item ? item.slice(prefix.length) : undefined;
}

async function main() {
  const outputPath = getArgument('output') ?? 'manager-connection-report.json';
  const result = await runConnectionCheck({
    url: process.env.MANAGER_DASHBOARD_SNAPSHOT_URL,
    timeoutMs: process.env.MANAGER_CONNECTION_TIMEOUT_MS,
    retries: process.env.MANAGER_CONNECTION_RETRIES,
    maxAgeMinutes: process.env.MANAGER_SNAPSHOT_MAX_AGE_MINUTES,
    freshnessPolicy: process.env.MANAGER_SNAPSHOT_FRESHNESS_POLICY,
  });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.connected ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
