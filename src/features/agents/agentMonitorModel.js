export const AGENT_REGISTRY = Object.freeze([
  { id: 'manager', name: 'Manager' },
  { id: 'database', name: 'Database' },
  { id: 'scanner', name: 'Scanner' },
  { id: 'technical', name: 'Technical' },
  { id: 'fundamental', name: 'Fundamental' },
  { id: 'market_regime', name: 'Market Regime' },
  { id: 'learning', name: 'Learning' },
  { id: 'performance', name: 'Performance' },
  { id: 'portfolio', name: 'Portfolio' },
  { id: 'profit', name: 'Profit' },
  { id: 'risk', name: 'Risk' },
  { id: 'execution', name: 'Execution' },
  { id: 'curator', name: 'Curator' },
]);

const HEALTHY_STATES = new Set(['healthy', 'ok', 'operational', 'ready', 'running', 'success']);
const ATTENTION_STATES = new Set([
  'critical',
  'degraded',
  'error',
  'failed',
  'failure',
  'offline',
  'unhealthy',
  'warning',
]);

function normalizedIdentifier(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_agent$/, '');
}

export function canonicalAgentId(agent) {
  const candidates = [agent?.id, agent?.name];
  return candidates
    .map(normalizedIdentifier)
    .find((candidate) => AGENT_REGISTRY.some((item) => item.id === candidate)) || null;
}

export function agentHealthGroup(health) {
  const normalized = normalizedIdentifier(health);
  if (HEALTHY_STATES.has(normalized)) return 'healthy';
  if (ATTENTION_STATES.has(normalized)) return 'attention';
  return 'unknown';
}

export function deriveAgentMonitor({ agents = [], query = '', filter = 'all' } = {}) {
  const telemetryById = new Map();
  agents.forEach((agent) => {
    const id = canonicalAgentId(agent);
    if (id && !telemetryById.has(id)) telemetryById.set(id, agent);
  });

  const records = AGENT_REGISTRY.map((registryAgent) => {
    const telemetry = telemetryById.get(registryAgent.id) || null;
    return {
      ...registryAgent,
      telemetry,
      reporting: Boolean(telemetry),
      healthGroup: telemetry ? agentHealthGroup(telemetry.health) : 'unavailable',
    };
  });
  const reporting = records.filter((agent) => agent.reporting).length;
  const healthy = records.filter((agent) => agent.healthGroup === 'healthy').length;
  const attention = records.filter((agent) => agent.healthGroup === 'attention').length;
  const unavailable = records.length - reporting;
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const visibleAgents = records.filter((agent) => {
    const searchable = [
      agent.name,
      agent.id,
      agent.telemetry?.name,
      agent.telemetry?.health,
      agent.telemetry?.status,
      agent.telemetry?.version,
    ].join(' ').toLocaleLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (filter === 'all' || agent.healthGroup === filter);
  });

  return {
    agents: visibleAgents,
    counts: { total: records.length, reporting, healthy, attention, unavailable },
    ignoredTelemetryCount: agents.filter((agent) => !canonicalAgentId(agent)).length,
  };
}
