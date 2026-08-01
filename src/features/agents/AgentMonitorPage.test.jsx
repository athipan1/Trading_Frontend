import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import successFixture from '../../../tests/fixtures/dashboard/success.json';
import { translations } from '../../i18n.js';
import { normalizeSnapshot } from '../../services/api.js';
import AgentMonitorPage from './AgentMonitorPage.jsx';

afterEach(cleanup);

function renderAgents(agents = []) {
  const snapshot = normalizeSnapshot({ ...successFixture, agents });
  return render(<AgentMonitorPage snapshot={snapshot} language="en" t={translations.en} />);
}

describe('Agent Monitor workspace', () => {
  it('shows all expected agents and honest unavailable telemetry by default', () => {
    renderAgents();
    expect(screen.getByRole('status')).toHaveTextContent('Agent telemetry is not published');
    expect(screen.getByTestId('agent-table-view').querySelectorAll('tbody tr')).toHaveLength(13);
    expect(screen.getByTestId('agent-card-manager')).toHaveTextContent('Not published by Manager');
    expect(screen.getByTestId('agent-card-execution')).toHaveTextContent('Unavailable');
  });

  it('renders allowlisted Manager telemetry with health and resource metrics', () => {
    renderAgents([
      {
        id: 'manager_agent',
        name: 'Manager Agent',
        health: 'healthy',
        status: 'running',
        latencyMs: 28,
        version: '2.4.1',
        cpuPercent: 12.5,
        memoryMb: 384,
        lastRunAt: '2026-07-30T00:00:00Z',
      },
    ]);
    const card = screen.getByTestId('agent-card-manager');
    expect(card).toHaveTextContent('Healthy');
    expect(card).toHaveTextContent('28 ms');
    expect(card).toHaveTextContent('2.4.1');
    expect(card).toHaveTextContent('12.5%');
    expect(card).toHaveTextContent('384 MB');
    expect(card).toHaveTextContent('running');
  });

  it('searches and filters without hiding unreported agents from the source registry', () => {
    renderAgents([
      { id: 'manager', health: 'healthy', status: 'running' },
      { id: 'risk', health: 'warning', status: 'blocked' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Needs attention' }));
    const table = screen.getByTestId('agent-table-view');
    expect(within(table).getByText('Risk')).toBeVisible();
    expect(within(table).queryByText('Manager')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All agents' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search agents' }), {
      target: { value: 'curator' },
    });
    expect(within(table).getByText('Curator')).toBeVisible();
    expect(within(table).queryByText('Risk')).not.toBeInTheDocument();
  });
});
