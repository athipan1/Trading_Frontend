import {
  Activity,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CircleDollarSign,
  Database,
  Gauge,
  Landmark,
  LineChart,
  Radio,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Waves,
  Workflow,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import { formatBangkokDateTime } from '../../utils/dateTime.js';
import { deriveAgentMonitor } from './agentMonitorModel.js';

const AGENT_ICONS = Object.freeze({
  manager: Workflow,
  database: Database,
  scanner: Search,
  technical: LineChart,
  fundamental: Landmark,
  market_regime: Waves,
  learning: BrainCircuit,
  performance: Gauge,
  portfolio: BriefcaseBusiness,
  profit: CircleDollarSign,
  risk: ShieldCheck,
  execution: Activity,
  curator: Sparkles,
});

const SUMMARY_ICONS = Object.freeze({
  total: Bot,
  reporting: Radio,
  healthy: Activity,
  attention: ShieldCheck,
  unavailable: Server,
});

function metricValue(value, suffix, unavailable) {
  return value === null || value === undefined ? unavailable : `${value}${suffix}`;
}

function memoryValue(telemetry, unavailable) {
  if (!telemetry) return unavailable;
  if (telemetry.memoryPercent !== null && telemetry.memoryPercent !== undefined) {
    return `${telemetry.memoryPercent}%`;
  }
  if (telemetry.memoryMb !== null && telemetry.memoryMb !== undefined) {
    return `${telemetry.memoryMb} MB`;
  }
  return unavailable;
}

function HealthBadge({ agent, t }) {
  const label = agent.reporting
    ? (t.agentHealthGroups[agent.healthGroup] || t.agentHealthGroups.unknown)
    : t.agentHealthGroups.unavailable;
  return (
    <span className={`agent-health-badge ${agent.healthGroup}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function AgentIdentity({ agent, t }) {
  const Icon = AGENT_ICONS[agent.id] || Bot;
  return (
    <div className="agent-identity">
      <span className="agent-icon"><Icon aria-hidden="true" /></span>
      <div>
        <strong>{agent.name}</strong>
        <span>{t.agentRoles[agent.id]}</span>
      </div>
    </div>
  );
}

function AgentCards({ agents, language, t }) {
  return (
    <div className="agent-monitor-cards" data-testid="agent-card-view">
      {agents.map((agent) => {
        const telemetry = agent.telemetry;
        return (
          <article className="agent-monitor-card" key={agent.id} data-testid={`agent-card-${agent.id}`}>
            <div className="agent-card-heading">
              <AgentIdentity agent={agent} t={t} />
              <HealthBadge agent={agent} t={t} />
            </div>
            <dl>
              <div><dt>{t.agentLatency}</dt><dd>{metricValue(telemetry?.latencyMs, ' ms', t.telemetryUnavailable)}</dd></div>
              <div><dt>{t.agentVersion}</dt><dd>{telemetry?.version || t.telemetryUnavailable}</dd></div>
              <div><dt>{t.agentCpu}</dt><dd>{metricValue(telemetry?.cpuPercent, '%', t.telemetryUnavailable)}</dd></div>
              <div><dt>{t.agentMemory}</dt><dd>{memoryValue(telemetry, t.telemetryUnavailable)}</dd></div>
              <div><dt>{t.agentStatus}</dt><dd>{telemetry?.status || t.telemetryNotPublished}</dd></div>
              <div><dt>{t.agentLastRun}</dt><dd>{formatBangkokDateTime(telemetry?.lastRunAt, language, t.telemetryUnavailable)}</dd></div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function AgentTable({ agents, language, t }) {
  return (
    <div className="agent-monitor-table-wrap" role="region" aria-label={t.agentTableScroll} tabIndex="0" data-testid="agent-table-view">
      <table className="agent-monitor-table">
        <colgroup>
          <col className="agent-col-name" />
          <col className="agent-col-health" />
          <col className="agent-col-latency" />
          <col className="agent-col-version" />
          <col className="agent-col-cpu" />
          <col className="agent-col-memory" />
          <col className="agent-col-status" />
          <col className="agent-col-last-run" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t.agentName}</th>
            <th scope="col">{t.agentHealth}</th>
            <th scope="col">{t.agentLatency}</th>
            <th scope="col">{t.agentVersion}</th>
            <th scope="col">{t.agentCpu}</th>
            <th scope="col">{t.agentMemory}</th>
            <th scope="col">{t.agentStatus}</th>
            <th scope="col">{t.agentLastRun}</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const telemetry = agent.telemetry;
            return (
              <tr key={agent.id}>
                <td><AgentIdentity agent={agent} t={t} /></td>
                <td><HealthBadge agent={agent} t={t} /></td>
                <td>{metricValue(telemetry?.latencyMs, ' ms', '—')}</td>
                <td>{telemetry?.version || '—'}</td>
                <td>{metricValue(telemetry?.cpuPercent, '%', '—')}</td>
                <td>{memoryValue(telemetry, '—')}</td>
                <td>{telemetry?.status || t.agentHealthGroups.unavailable}</td>
                <td>{formatBangkokDateTime(telemetry?.lastRunAt, language, '—')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AgentMonitorPage({ snapshot, language, t }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const monitor = useMemo(() => deriveAgentMonitor({
    agents: snapshot.agents,
    query,
    filter,
  }), [filter, query, snapshot.agents]);
  const summaryCards = ['total', 'reporting', 'healthy', 'attention', 'unavailable'];

  return (
    <div className="page-stack agent-monitor" data-testid="page-agents">
      <section className="agent-boundary" aria-label={t.agentBoundaryTitle}>
        <div className="agent-boundary-icon"><ShieldCheck aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">{t.agentBoundaryEyebrow}</p>
          <h2>{t.agentBoundaryTitle}</h2>
          <p>{t.agentBoundaryDescription}</p>
        </div>
        <span className="status good">{t.managerOnly}</span>
      </section>

      <section className="agent-summary-grid" aria-label={t.agentSummary}>
        {summaryCards.map((key) => {
          const Icon = SUMMARY_ICONS[key];
          return (
            <article className={`agent-summary-card ${key}`} key={key}>
              <Icon aria-hidden="true" />
              <div><span>{t.agentSummaryLabels[key]}</span><strong>{monitor.counts[key]}</strong></div>
            </article>
          );
        })}
      </section>

      {!monitor.counts.reporting ? (
        <div className="agent-contract-notice" role="status">
          <Server aria-hidden="true" />
          <div><strong>{t.agentTelemetryPendingTitle}</strong><p>{t.agentTelemetryPendingDescription}</p></div>
        </div>
      ) : null}

      <section className="panel agent-toolbar" aria-label={t.agentTools}>
        <label className="agent-search">
          <span className="sr-only">{t.searchAgents}</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchAgentsPlaceholder}
            aria-label={t.searchAgents}
          />
        </label>
        <div className="agent-health-filters" role="group" aria-label={t.filterAgentHealth}>
          {['all', 'healthy', 'attention', 'unavailable'].map((key) => (
            <button
              type="button"
              key={key}
              className={filter === key ? 'active' : ''}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {t.agentFilterLabels[key]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel agent-list-panel" aria-labelledby="agent-list-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.agentRegistryEyebrow}</p>
            <h2 id="agent-list-heading">{t.agentRegistryTitle}</h2>
          </div>
          <span className="pill">{monitor.agents.length} / {monitor.counts.total}</span>
        </div>
        {monitor.agents.length ? (
          <>
            <AgentTable agents={monitor.agents} language={language} t={t} />
            <AgentCards agents={monitor.agents} language={language} t={t} />
          </>
        ) : (
          <EmptyState
            icon={Search}
            title={t.noAgentMatches}
            description={t.noAgentMatchesDescription}
            testId="agent-monitor-empty-state"
          />
        )}
      </section>

      <section className="panel agent-evidence" aria-labelledby="agent-evidence-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.agentEvidenceEyebrow}</p>
            <h2 id="agent-evidence-heading">{t.agentEvidenceTitle}</h2>
          </div>
          <span className={`status ${snapshot.freshness?.isStale ? 'warn' : 'neutral-status'}`}>
            {snapshot.freshness?.isStale ? t.agentSnapshotStale : t.agentSnapshotCurrent}
          </span>
        </div>
        <p>{t.agentEvidenceDescription}</p>
        <dl>
          <div><dt>{t.lastUpdated}</dt><dd>{formatBangkokDateTime(snapshot.generatedAt, language, t.notUpdated)}</dd></div>
          <div><dt>{t.workflowStatus}</dt><dd>{snapshot.workflow?.conclusion || snapshot.workflow?.status || t.telemetryUnavailable}</dd></div>
          <div><dt>{t.runtimeMode}</dt><dd>{snapshot.runtime?.mode || t.telemetryUnavailable}</dd></div>
        </dl>
      </section>
    </div>
  );
}
