import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import successFixture from '../../../tests/fixtures/dashboard/success.json';
import { translations } from '../../i18n.js';
import { normalizeSnapshot } from '../../services/api.js';
import BacktestPage from './BacktestPage.jsx';

afterEach(cleanup);

function renderBacktest({ payload = successFixture, managerControlAvailable = false, canRunBacktest = false, onRunBacktest = vi.fn() } = {}) {
  return render(
    <BacktestPage
      snapshot={normalizeSnapshot(payload)}
      language="en"
      t={translations.en}
      managerControlAvailable={managerControlAvailable}
      canRunBacktest={canRunBacktest}
      onRunBacktest={onRunBacktest}
    />,
  );
}

describe('Backtest workspace', () => {
  it('renders Manager-published statistics, curve, history, and simulated trades', () => {
    renderBacktest();
    expect(screen.getAllByText('1.42')[0]).toBeVisible();
    expect(screen.getAllByText('62.5%')[0]).toBeVisible();
    expect(screen.getByTestId('backtest-profit-curve').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('backtest-history-table')).toHaveTextContent('bt-2026-07-29-value-rebound');
    expect(screen.getByTestId('backtest-trade-table')).toHaveTextContent('ACGL');
    expect(screen.getByRole('button', { name: 'Run backtest' })).toBeDisabled();
    expect(screen.getByText(/Public snapshot mode is read-only/)).toBeVisible();
  });

  it('submits a normalized run only through an enabled Manager capability', async () => {
    const onRunBacktest = vi.fn().mockResolvedValue({ data: { id: 'bt-new', status: 'queued' } });
    renderBacktest({ managerControlAvailable: true, canRunBacktest: true, onRunBacktest });
    fireEvent.click(screen.getByRole('button', { name: 'Run backtest' }));

    await waitFor(() => expect(onRunBacktest).toHaveBeenCalledWith({
      strategy: 'value_rebound',
      symbols: ['ACGL', 'MSFT'],
      startDate: '2026-01-02',
      endDate: '2026-06-02',
      initialCapital: 50000,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('bt-new');
  });

  it('keeps absent Manager backtest data explicit and validates unsafe form input', async () => {
    const payload = structuredClone(successFixture);
    delete payload.backtest;
    renderBacktest({ payload, managerControlAvailable: true, canRunBacktest: true });
    expect(screen.getByRole('status')).toHaveTextContent('has not published backtest results');
    expect(screen.getByTestId('backtest-curve-empty')).toBeVisible();
    expect(screen.getByTestId('backtest-history-empty')).toBeVisible();
    expect(screen.getByTestId('backtest-trades-empty')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Symbols'), { target: { value: '$BAD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run backtest' }));
    expect(await screen.findByText(/valid ticker symbols/)).toBeVisible();
  });
});
