import { describe, expect, it } from 'vitest';
import {
  AGENT_REGISTRY,
  agentHealthGroup,
  canonicalAgentId,
  deriveAgentMonitor,
} from './agentMonitorModel.js';

describe('agent monitor model', () => {
  it('keeps all 13 expected agents visible without fabricating telemetry', () => {
    const monitor = deriveAgentMonitor();
    expect(AGENT_REGISTRY).toHaveLength(13);
    expect(monitor.agents).toHaveLength(13);
    expect(monitor.counts).toEqual({
      total: 13,
      reporting: 0,
      healthy: 0,
      attention: 0,
      unavailable: 13,
    });
    expect(monitor.agents.every((agent) => agent.healthGroup === 'unavailable')).toBe(true);
  });

  it('maps Manager agent aliases and classifies only explicit health evidence', () => {
    expect(canonicalAgentId({ id: 'Manager_Agent' })).toBe('manager');
    expect(canonicalAgentId({ name: 'Market Regime Agent' })).toBe('market_regime');
    expect(canonicalAgentId({ id: 'unknown-worker' })).toBeNull();
    expect(agentHealthGroup('operational')).toBe('healthy');
    expect(agentHealthGroup('degraded')).toBe('attention');
    expect(agentHealthGroup('busy')).toBe('unknown');
  });

  it('deduplicates Manager telemetry and ignores unregistered records', () => {
    const monitor = deriveAgentMonitor({
      agents: [
        { id: 'risk_agent', health: 'healthy', status: 'ready' },
        { id: 'risk', health: 'offline', status: 'duplicate' },
        { id: 'vendor-agent', health: 'healthy', status: 'ready' },
      ],
    });
    expect(monitor.counts.reporting).toBe(1);
    expect(monitor.counts.healthy).toBe(1);
    expect(monitor.ignoredTelemetryCount).toBe(1);
    expect(monitor.agents.find((agent) => agent.id === 'risk')?.telemetry?.status).toBe('ready');
  });

  it('filters and searches the fixed registry without changing its order', () => {
    const agents = [
      { id: 'manager', health: 'healthy', status: 'running', version: '1.2.3' },
      { id: 'risk', health: 'warning', status: 'blocked' },
    ];
    expect(deriveAgentMonitor({ agents, filter: 'attention' }).agents.map((agent) => agent.id))
      .toEqual(['risk']);
    expect(deriveAgentMonitor({ agents, query: '1.2.3' }).agents.map((agent) => agent.id))
      .toEqual(['manager']);
    expect(deriveAgentMonitor({ agents }).agents.slice(0, 3).map((agent) => agent.id))
      .toEqual(['manager', 'database', 'scanner']);
  });
});
