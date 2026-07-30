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
    ['no candidate', noCandidateFixture, 'no_preselected_backtest_symbols'],
    ['risk rejected', riskRejectedFixture, 'risk_rejected'],
    ['execution success', executionSuccessFixture, 'paper_order_submitted'],
    ['execution failure', executionFailureFixture, 'paper_broker_rejected'],
    ['workflow failure', workflowFailureFixture, 'Hourly Auto Trading did not complete successfully.'],
    ['cancelled', cancelledFixture, 'Hourly Auto Trading was cancelled before completion.'],
  ])('renders %s state with text and icon semantics', (name, fixture, expectedText) => {
    renderStatus(fixture);
    expect(screen.getByTestId('hourly-automation-status')).toHaveTextContent(expectedText);
  });

  it('shows stale warning without discarding the snapshot', () => {
    renderStatus(staleFixture);
    expect(screen.getByRole('alert')).toHaveTextContent('Stale data');
    expect(screen.getByText('Run #107')).toBeVisible();
  });

  it('shows privacy masking and never renders masked account values', () => {
    renderStatus(maskedFixture);
    expect(screen.getByText('Financial values are masked')).toBeVisible();
    expect(screen.queryByText('48155.5')).not.toBeInTheDocument();
  });

  it('announces partial fills and supports refresh interaction', () => {
    const fixture = structuredClone(executionSuccessFixture);
    fixture.cycle.executionStatus = 'partial_fill';
    fixture.cycle.partialFillDetected = true;
    const onRefresh = vi.fn();
    renderStatus(fixture, { onRefresh });
    expect(screen.getByText('Partial fill detected')).toBeVisible();
    const button = screen.getByRole('button', { name: 'Refresh now' });
    button.focus();
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not render a run link for a non-GitHub host', () => {
    const fixture = structuredClone(successFixture);
    fixture.workflow.runUrl = 'https://example.com/run/123';
    renderStatus(fixture);
    expect(screen.queryByRole('link', { name: 'Open GitHub Actions run' })).not.toBeInTheDocument();
  });
});
