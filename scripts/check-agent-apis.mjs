const agents = [
  {
    name: 'Manager Agent',
    env: 'MANAGER_API_URL',
    healthPaths: ['/health', '/'],
    dataPaths: ['/dashboard/snapshot', '/reports/latest', '/portfolio/latest'],
  },
  {
    name: 'Database Agent',
    env: 'DATABASE_API_URL',
    healthPaths: ['/health', '/'],
    dataPaths: ['/accounts/1/portfolio', '/accounts/1/orders', '/accounts/1/positions'],
  },
  {
    name: 'Execution Agent',
    env: 'EXECUTION_API_URL',
    healthPaths: ['/health', '/'],
    dataPaths: ['/portfolio', '/orders', '/positions'],
  },
  {
    name: 'Risk Agent',
    env: 'RISK_API_URL',
    healthPaths: ['/health', '/'],
    dataPaths: ['/risk/session/1', '/session-risk/1'],
    optional: true,
  },
  {
    name: 'Curator Agent',
    env: 'CURATOR_API_URL',
    healthPaths: ['/health', '/'],
    dataPaths: ['/skills/search?q=technical&approval_status=approved'],
    optional: true,
  },
];

const timeoutMs = Number(process.env.API_CHECK_TIMEOUT_MS || 8000);
const strictMode = process.env.API_CHECK_STRICT === 'true';
const apiKey = process.env.AGENT_API_KEY || process.env.DATABASE_AGENT_API_KEY || '';

function joinUrl(baseUrl, path) {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: apiKey ? { 'X-API-KEY': apiKey } : {},
    });
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function firstReachable(baseUrl, paths) {
  const attempts = [];
  for (const path of paths) {
    const url = joinUrl(baseUrl, path);
    try {
      const result = await fetchWithTimeout(url);
      attempts.push({ path, ...result });
      if (result.ok) return { ok: true, path, result, attempts };
    } catch (error) {
      attempts.push({ path, ok: false, error: error.message });
    }
  }
  return { ok: false, attempts };
}

const rows = [];
let failed = false;

for (const agent of agents) {
  const baseUrl = process.env[agent.env];
  if (!baseUrl) {
    rows.push({ agent: agent.name, status: agent.optional ? 'skipped' : 'missing_env', detail: agent.env });
    if (!agent.optional && strictMode) failed = true;
    continue;
  }

  const health = await firstReachable(baseUrl, agent.healthPaths);
  const data = await firstReachable(baseUrl, agent.dataPaths);
  const status = health.ok && data.ok ? 'ready' : health.ok ? 'health_only' : 'unreachable';

  rows.push({
    agent: agent.name,
    status,
    healthPath: health.path || '-',
    dataPath: data.path || '-',
    env: agent.env,
  });

  if (strictMode && !agent.optional && status !== 'ready') {
    failed = true;
  }
}

console.table(rows);

if (failed) {
  console.error('Required agent API connectivity checks failed in strict mode.');
  process.exit(1);
}
