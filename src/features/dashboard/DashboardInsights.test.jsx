import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { translations } from '../../i18n.js';
import DashboardInsights from './DashboardInsights.jsx';

const snapshot = {
  runtime: { liveTradingEnabled: false },
  workflow: { conclusion: 'success' },
  account: { valuesMasked: false },
  privacy: { valuesMasked: false },
  positions: [
    { symbol: 'AAPL', marketValue: 750, unrealizedPnL: 25, valuesMasked: false },
    { symbol: 'MSFT', marketValue: 250, unrealizedPnL: -10, valuesMasked: false },
  ],
  phases: [{ name: 'risk', status: 'failure', message: 'Risk rejected candidate' }],
};

afterEach(cleanup);

describe('DashboardInsights', () => {
  it('renders allocation, honest unrealized P/L, activity, and the paper boundary', () => {
    render(<DashboardInsights snapshot={snapshot} language="en" t={translations.en} />);

    expect(screen.getByTestId('allocation-chart')).toHaveTextContent('AAPL75.00%$750.00');
    expect(screen.getByText('$15.00')).toHaveClass('positive');
    expect(screen.getByTestId('recent-automation-activity')).toHaveTextContent('Risk rejected candidate');
    expect(screen.getByTestId('safety-posture')).toHaveTextContent(translations.en.paperBoundaryActive);
  });

  it('shows safe empty states for masked or unavailable insight data', () => {
    render(
      <DashboardInsights
        snapshot={{ ...snapshot, privacy: { valuesMasked: true }, positions: [], phases: [] }}
        language="th"
        t={translations.th}
      />,
    );

    expect(screen.getByText(translations.th.allocationUnavailable)).toBeVisible();
    expect(screen.getByText(translations.th.activityUnavailable)).toBeVisible();
    expect(screen.getAllByText(translations.th.masked).length).toBeGreaterThan(0);
  });

  it('does not claim the paper boundary is safe when runtime evidence is missing', () => {
    const view = render(
      <DashboardInsights
        snapshot={{ account: {}, positions: [], phases: [], workflow: {} }}
        language="en"
        t={translations.en}
      />,
    );

    expect(view.getByTestId('safety-posture')).toHaveTextContent(translations.en.runtimeUnknown);
    expect(view.getByTestId('safety-posture')).toHaveClass('unknown');
  });
});
