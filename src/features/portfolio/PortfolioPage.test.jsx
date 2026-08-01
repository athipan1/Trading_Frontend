import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import successFixture from '../../../tests/fixtures/dashboard/success.json';
import { translations } from '../../i18n.js';
import { normalizeSnapshot } from '../../services/api.js';
import PortfolioPage from './PortfolioPage.jsx';

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPortfolio(payload = successFixture) {
  return render(<PortfolioPage snapshot={normalizeSnapshot(payload)} t={translations.en} />);
}

describe('professional portfolio workspace', () => {
  it('switches views and opens a focus-managed position detail drawer', async () => {
    renderPortfolio();
    expect(screen.getByTestId('position-table-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getByTestId('position-card-ACGL')).toBeInTheDocument();

    const details = screen.getByRole('button', { name: 'View position details: ACGL' });
    details.focus();
    fireEvent.click(details);

    expect(screen.getByRole('dialog', { name: 'ACGL' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close position details' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'ACGL' })).not.toBeInTheDocument();
    await waitFor(() => expect(details).toHaveFocus());
  });

  it('searches visible positions and clears an empty result', () => {
    renderPortfolio();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search positions' }), {
      target: { value: 'MSFT' },
    });

    expect(screen.getByTestId('positions-filter-empty-state')).toHaveTextContent(
      'No matching positions',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByText('ACGL')).not.toHaveLength(0);
  });

  it('downloads filtered CSV with a deterministic snapshot filename', () => {
    const createObjectURL = vi.fn(() => 'blob:portfolio');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPortfolio();

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('portfolio-2026-07-30.csv');
  });
});
