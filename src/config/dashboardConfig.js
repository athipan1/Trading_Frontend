export const DATA_SOURCES = Object.freeze({
  MOCK: 'mock',
  PUBLIC_SNAPSHOT: 'public-snapshot',
  MANAGER_API: 'manager-api',
});

const SUPPORTED_DATA_SOURCES = new Set(Object.values(DATA_SOURCES));
const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const MIN_REFRESH_INTERVAL_MS = 5_000;
const MAX_REFRESH_INTERVAL_MS = 15 * 60_000;

export class DashboardConfigError extends Error {
  constructor(message) {
    super(`Dashboard configuration error: ${message}`);
    this.name = 'DashboardConfigError';
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaseUrl(value) {
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function validateUrl(value, variableName, { isProduction, allowRelative }) {
  if (allowRelative && value.startsWith('/')) {
    if (value.startsWith('//') || value.includes('?') || value.includes('#')) {
      throw new DashboardConfigError(`${variableName} must be a clean same-origin path such as /api.`);
    }
    return normalizeBaseUrl(value);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new DashboardConfigError(`${variableName} must be a valid http(s) URL${allowRelative ? ' or same-origin path' : ''}.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new DashboardConfigError(`${variableName} must use http or https.`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new DashboardConfigError(`${variableName} must not contain credentials, query parameters, or fragments.`);
  }
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (isProduction && parsed.protocol !== 'https:' && !localHost) {
    throw new DashboardConfigError(`${variableName} must use HTTPS in production.`);
  }
  return normalizeBaseUrl(parsed.toString());
}

function parseRefreshInterval(value) {
  if (value === undefined || value === null || text(String(value)) === '') {
    return DEFAULT_REFRESH_INTERVAL_MS;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_REFRESH_INTERVAL_MS || parsed > MAX_REFRESH_INTERVAL_MS) {
    throw new DashboardConfigError(
      `VITE_REFRESH_INTERVAL_MS must be an integer between ${MIN_REFRESH_INTERVAL_MS} and ${MAX_REFRESH_INTERVAL_MS}.`,
    );
  }
  return parsed;
}

export function resolveDashboardConfig(env = {}, { isProduction = false } = {}) {
  const configuredSource = text(env.VITE_DATA_SOURCE).toLowerCase();
  const dataSource = configuredSource || (isProduction ? DATA_SOURCES.MANAGER_API : DATA_SOURCES.MOCK);

  if (!SUPPORTED_DATA_SOURCES.has(dataSource)) {
    throw new DashboardConfigError(
      `VITE_DATA_SOURCE must be one of: ${[...SUPPORTED_DATA_SOURCES].join(', ')}. Received ${dataSource || '(empty)'}.`,
    );
  }

  const managerUrl = text(env.VITE_MANAGER_API_URL);
  const snapshotUrl = text(env.VITE_DASHBOARD_SNAPSHOT_URL);

  if (dataSource === DATA_SOURCES.MANAGER_API && !managerUrl) {
    throw new DashboardConfigError('VITE_MANAGER_API_URL is required when VITE_DATA_SOURCE=manager-api.');
  }
  if (dataSource === DATA_SOURCES.PUBLIC_SNAPSHOT && !snapshotUrl) {
    throw new DashboardConfigError(
      'VITE_DASHBOARD_SNAPSHOT_URL is required when VITE_DATA_SOURCE=public-snapshot.',
    );
  }

  return Object.freeze({
    dataSource,
    managerApiUrl: managerUrl
      ? validateUrl(managerUrl, 'VITE_MANAGER_API_URL', { isProduction, allowRelative: true })
      : '',
    snapshotUrl: snapshotUrl
      ? validateUrl(snapshotUrl, 'VITE_DASHBOARD_SNAPSHOT_URL', { isProduction, allowRelative: false })
      : '',
    refreshIntervalMs: parseRefreshInterval(env.VITE_REFRESH_INTERVAL_MS),
  });
}

export function importMetaDashboardEnv(metaEnv = {}) {
  return {
    VITE_DATA_SOURCE: metaEnv.VITE_DATA_SOURCE,
    VITE_MANAGER_API_URL: metaEnv.VITE_MANAGER_API_URL,
    VITE_DASHBOARD_SNAPSHOT_URL: metaEnv.VITE_DASHBOARD_SNAPSHOT_URL,
    VITE_REFRESH_INTERVAL_MS: metaEnv.VITE_REFRESH_INTERVAL_MS,
  };
}
