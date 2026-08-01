import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { translations } from '../i18n.js';
import SignalsPanel from './SignalsPanel.jsx';

describe('SignalsPanel', () => {
  const t = translations.en;

  it('shows an explicit empty state', () => {
    render(<SignalsPanel signals={[]} t={t} />);

    expect(screen.getByTestId('signals-empty-state')).toBeVisible();
    expect(screen.getByText(t.noSignalsTitle)).toBeVisible();
  });

  it('renders sanitized advisory values as read-only information', () => {
    render(
      <SignalsPanel
        signals={[{ symbol: 'AAPL', skill: 'momentum', status: 'approved', signal: 'BUY', confidence: 0.8125 }]}
        t={t}
      />,
    );

    expect(screen.getByText('AAPL')).toBeVisible();
    expect(screen.getByText('momentum')).toBeVisible();
    expect(screen.getByText('approved')).toBeVisible();
    expect(screen.getByText('BUY')).toBeVisible();
    expect(screen.getByText('81.25%')).toBeVisible();
  });
});
