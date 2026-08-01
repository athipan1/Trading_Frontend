import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import successFixture from '../../../tests/fixtures/dashboard/success.json';
import { translations } from '../../i18n.js';
import { normalizeSnapshot } from '../../services/api.js';
import RiskDashboardPage from './RiskDashboardPage.jsx';

afterEach(cleanup);

function renderRisk(payload = successFixture) {
  const snapshot = normalizeSnapshot(payload);
  return render(<RiskDashboardPage snapshot={snapshot} language="en" t={translations.en} />);
}

describe('Risk Dashboard workspace', () => {
  it('renders Manager-published risk, sector, limits, and halt evidence', () => {
    renderRisk();
    expect(screen.getByTestId('risk-level')).toHaveTextContent('Moderate');
    expect(screen.getByTestId('gross-exposure')).toHaveTextContent('7.8%');
    expect(screen.getByTestId('drawdown')).toHaveTextContent('1.2%');
    expect(screen.getByTestId('sector-allocation')).toHaveTextContent('Financials');
    expect(screen.getByTestId('risk-limits')).toHaveTextContent('35.0%');
    expect(screen.getByTestId('emergency-halt')).toHaveTextContent('Inactive');
    expect(screen.getByTestId('emergency-halt')).toHaveTextContent('Read-only');
  });

  it('shows calculated exposure but does not invent unpublished risk fields or halt controls', () => {
    const payload = structuredClone(successFixture);
    delete payload.risk;
    renderRisk(payload);
    expect(screen.getByRole('status')).toHaveTextContent('has not published the optional risk contract');
    expect(screen.getByTestId('gross-exposure')).toHaveTextContent('Calculated snapshot');
    expect(screen.getByTestId('drawdown')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('risk-level')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('emergency-halt')).toHaveTextContent('Not published');
    expect(screen.queryByRole('button', { name: /halt/i })).not.toBeInTheDocument();
  });
});
