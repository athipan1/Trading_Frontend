import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import successFixture from '../../tests/fixtures/dashboard/success.json';
import noCandidateFixture from '../../tests/fixtures/dashboard/no-candidate.json';
import riskRejectedFixture from '../../tests/fixtures/dashboard/risk-rejected.json';
import executionSuccessFixture from '../../tests/fixtures/dashboard/execution-success.json';
import executionFailureFixture from '../../tests/fixtures/dashboard/execution-failure.json';
import workflowFailureFixture from '../../tests/fixtures/dashboard/workflow-failure.json';
import cancelledFixture from '../../tests/fixtures/dashboard/cancelled.json';
import staleFixture from '../../tests/fixtures/dashboard/stale.json';
import maskedFixture from '../../tests/fixtures/dashboard/masked.json';
import { normalizeSnapshot } from '../services/api.js';
import HourlyAutomationStatus from './HourlyAutomationStatus.jsx';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-30T00:12:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderStatus(fixture = successFixture, props = {}) {
  return render(
    <HourlyAutomationStatus
      snapshot={normalizeSnapshot(fixture)}
      language="en"
      isLoading={false}
      isRefreshing={false}
      onRefresh={vi.fn()}
      {...props}
    />,
  );
}

function incidentSummary() {
  return screen.getByTestId('system-incident-summary');
}

describe('HourlyAutomationStatus', () => {
  it('renders an accessible loading skeleton', () => {
    render(<HourlyAutomationStatus snapshot={null} language="en" isLoading isRefreshing={false} />);
    expect(screen.getByLabelText('Loading hourly automation status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders workflow metadata, Bangkok time, phases and GitHub run link', () => {
    renderStatus();
    const panel = screen.getByTestId('hourly-automation-status');
    expect(within(panel).getByRole('heading', { name: 'Hourly Automation Status' })).toBeVisible();
    expect(within(panel).getAllByText(/30 Jul 2026/).length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getAllByText(/07:00:00/).length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getByText('Run #100')).toBeVisible();
    expect(within(panel).getByText('ALPACA_PAPER')).toBeVisible();
    expect(within(panel).getByText('Risk', { exact: true })).toBeVisible();
    expect(within(panel).getByRole('link', { name: 'Open GitHub Actions run' })).toHaveAttribute(
      'href',
      'https://github.com/athipan1/Manager_Agent/actions/runs/123456789',
    );
  });

  it.each([
    ['no candidate', noCandidateFixture, 'normal', 'No symbol passed this cycle'],
    ['risk rejected', riskRejectedFixture, 'normal', 'Risk Agent rejected the trade'],
    ['execution submitted', executionSuccessFixture, 'normal', 'A paper-trading order was submitted'],
    ['execution failure', executionFailureFixture, 'critical', 'Paper-trading execution failed'],
    ['workflow failure', workflowFailureFixture, 'critical', 'The hourly workflow failed'],
    ['cancelled', cancelledFixture, 'warning', 'The workflow was cancelled before completion'],
    ['stale', staleFixture, 'warning', 'The dashboard snapshot is stale'],
  ])('classifies %s with the expected incident severity', (name, fixture, severity, title) => {
    renderStatus(fixture);
    expect(incidentSummary()).toHaveAttribute('data-severity', severity);
    expect(incidentSummary()).toHaveTextContent(title);
  });

  it('treats partial fills as critical and gives reconciliation guidance', () => {
    const fixture = structuredClone(executionSuccessFixture);
    fixture.cycle.executionStatus = 'partial_fill';
    fixture.cycle.executionReason = 'partial_fill';
    fixture.cycle.partialFillDetected = true;
    renderStatus(fixture);

    expect(incidentSummary()).toHaveAttribute('data-severity', 'critical');
    expect(incidentSummary()).toHaveTextContent('A partially filled order was detected');
    expect(incidentSummary()).toHaveTextContent('final reconciliation immediately');
  });

  it('fails closed when runtime leaves the paper or simulator boundary', () => {
    const fixture = structuredClone(executionSuccessFixture);
    fixture.runtime.mode = 'LIVE';
    fixture.runtime.liveTradingEnabled = true;
    renderStatus(fixture);

    expect(incidentSummary()).toHaveAttribute('data-severity', 'critical');
    expect(incidentSummary()).toHaveTextContent('Runtime is outside the safe boundary');
  });

  it('shows a readable reason while preserving the raw reason code', () => {
    renderStatus(riskRejectedFixture);
    const reason = screen.getByTestId('execution-reason');
    expect(reason).toHaveTextContent('Risk Agent rejected the trade');
    expect(reason).toHaveTextContent('risk_rejected');
  });

  it('shows privacy masking and never renders masked account values', () => {
    renderStatus(maskedFixture);
    expect(screen.getByText('Financial values are masked')).toBeVisible();
    expect(screen.queryByText('48155.5')).not.toBeInTheDocument();
  });

  it('supports an accessible phase timeline toggle', () => {
    renderStatus();
    const toggle = screen.getByRole('button', { name: 'Show all 8 phases' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'hourly-phase-timeline');

    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Show incident phases only');
    expect(screen.getByRole('list')).toHaveClass('expanded');
  });

  it('keeps the component refresh action for standalone use', () => {
    const onRefresh = vi.fn();
    renderStatus(successFixture, { onRefresh });
    const button = screen.getByRole('button', { name: 'Refresh now' });
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('hides the component refresh action when the page header owns refresh', () => {
    renderStatus(successFixture, { showRefreshAction: false });
    expect(screen.queryByRole('button', { name: 'Refresh now' })).not.toBeInTheDocument();
  });

  it('does not render a run link for a non-GitHub host', () => {
    const fixture = structuredClone(successFixture);
    fixture.workflow.runUrl = 'https://example.com/run/123';
    renderStatus(fixture);
    expect(screen.queryByRole('link', { name: 'Open GitHub Actions run' })).not.toBeInTheDocument();
  });
});
