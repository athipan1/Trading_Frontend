import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations } from '../../i18n.js';
import { getOwnerDashboardSnapshot } from '../../services/controlApi.js';
import OverviewPage from './OverviewPage.jsx';

vi.mock('../../services/controlApi.js', () => ({
  getOwnerDashboardSnapshot: vi.fn(),
}));

const publicSnapshot = {
  generatedAt: '2026-08-12T07:00:00.000Z',
  workflow: { conclusion: 'success' },
  runtime: { mode: 'PAPER', brokerMode: 'ALPACA', liveTradingEnabled: false },
  account: { cash: null, equity: null, buyingPower: null, status: 'ACTIVE', valuesMasked: true },
  positions: [],
  openOrders: [],
  signals: [],
  curatorSignals: [],
  phases: [],
  privacy: { mode: 'masked', valuesMasked: true },
};

const noCandidateSnapshot = {
  ...publicSnapshot,
  cycle: {
    status: 'success',
    executionStatus: 'not_attempted',
    executionReason: 'no_preselected_backtest_symbols',
  },
  phases: [
    { name: 'portfolio_review', status: 'success', message: 'Portfolio review completed' },
    { name: 'scanner', status: 'success', message: 'Scanner completed with no approved candidate' },
    { name: 'backtest', status: 'skipped', message: 'Skipped because Scanner produced no candidate' },
    { name: 'execution', status: 'skipped', message: 'No order was submitted' },
  ],
};

const ownerSnapshot = {
  ...publicSnapshot,
  account: {
    ...publicSnapshot.account,
    cash: 12500.25,
    equity: 15120.75,
    buyingPower: 25000.5,
    valuesMasked: false,
  },
  positions: [{
    symbol: 'AAPL',
    quantity: 2,
    marketValue: 410,
    unrealizedPnL: 10,
    valuesMasked: false,
    protection: { status: 'protected', hasStopLoss: true, hasTakeProfit: false, hasBracket: false },
  }],
  privacy: { mode: 'full', valuesMasked: false },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OverviewPage Owner Secure View', () => {
  it('keeps public values masked until authenticated, then can hide them again', async () => {
    getOwnerDashboardSnapshot.mockResolvedValue(ownerSnapshot);
    render(
      <OverviewPage
        snapshot={publicSnapshot}
        language="th"
        t={translations.th}
        onNavigate={vi.fn()}
        readOnlyMessage={translations.th.readOnlySnapshotMessage}
      />,
    );

    expect(screen.getByTestId('owner-secure-view')).toBeVisible();
    expect(screen.getAllByText(translations.th.masked).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId('owner-token-input'), { target: { value: 'owner-secret' } });
    fireEvent.click(screen.getByTestId('owner-connect-button'));

    await waitFor(() => expect(getOwnerDashboardSnapshot).toHaveBeenCalledWith({ operatorToken: 'owner-secret' }));
    expect(await screen.findByText('$12,500.25')).toBeVisible();
    expect(screen.getByTestId('owner-secure-status')).toHaveTextContent('ยืนยันเจ้าของแล้ว');
    expect(screen.queryByLabelText('Read-only public snapshot mode')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('owner-hide-values'));
    expect(screen.getAllByText(translations.th.masked).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Read-only public snapshot mode')).toBeVisible();
  });

  it('fails closed and keeps values masked when authentication fails', async () => {
    getOwnerDashboardSnapshot.mockRejectedValue(new Error('Invalid operator token.'));
    render(
      <OverviewPage
        snapshot={publicSnapshot}
        language="en"
        t={translations.en}
        onNavigate={vi.fn()}
        readOnlyMessage={translations.en.readOnlySnapshotMessage}
      />,
    );

    fireEvent.change(screen.getByTestId('owner-token-input'), { target: { value: 'bad-token' } });
    fireEvent.click(screen.getByTestId('owner-connect-button'));

    expect(await screen.findByText('Invalid operator token.')).toBeVisible();
    expect(screen.getAllByText(translations.en.masked).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Read-only public snapshot mode')).toBeVisible();
  });
});

describe('OverviewPage natural-language automation summary', () => {
  it('explains a no-candidate cycle in plain Thai and links to technical details', () => {
    const onNavigate = vi.fn();
    render(
      <OverviewPage
        snapshot={noCandidateSnapshot}
        language="th"
        t={translations.th}
        onNavigate={onNavigate}
      />,
    );

    const summary = screen.getByTestId('overview-natural-language-summary');
    expect(summary).toBeVisible();
    expect(summary).toHaveTextContent('เกิดอะไรขึ้นในรอบล่าสุด?');
    expect(summary).toHaveTextContent('ไม่มีหุ้นผ่านเงื่อนไขในรอบนี้');
    expect(summary).toHaveTextContent('Scanner หรือ Backtest ไม่พบ Candidate ที่ผ่านเกณฑ์ จึงไม่มีการส่งคำสั่ง');
    expect(summary).toHaveTextContent('รอรอบตามเวลาถัดไป ไม่ควรลดเกณฑ์เพียงเพื่อบังคับให้ระบบเทรด');

    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียดทางเทคนิค/i }));
    expect(onNavigate).toHaveBeenCalledWith('system');
  });
});
