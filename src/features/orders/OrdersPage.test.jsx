import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import successFixture from '../../../tests/fixtures/dashboard/success.json';
import { translations } from '../../i18n.js';
import { normalizeSnapshot } from '../../services/api.js';
import OrdersPage from './OrdersPage.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function payloadWithStatuses() {
  return {
    ...successFixture,
    openOrders: [
      successFixture.openOrders[0],
      { ...successFixture.openOrders[0], symbol: 'MSFT', status: 'filled', side: 'buy' },
      { ...successFixture.openOrders[0], symbol: 'AMD', status: 'rejected', side: 'buy' },
      { ...successFixture.openOrders[0], symbol: 'NVDA', status: 'canceled' },
      { ...successFixture.openOrders[0], symbol: 'META', status: 'vendor_new_state' },
    ],
  };
}

function renderOrders(payload = payloadWithStatuses()) {
  return render(
    <OrdersPage snapshot={normalizeSnapshot(payload)} language="en" t={translations.en} />,
  );
}

describe('order management workspace', () => {
  it('filters pending, filled, rejected, and cancelled snapshot orders', () => {
    renderOrders();
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('ACGL');
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('MSFT');

    fireEvent.click(screen.getByRole('button', { name: /Filled\s*1/ }));
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('MSFT');
    expect(screen.getByTestId('order-table-view')).not.toHaveTextContent('ACGL');

    fireEvent.click(screen.getByRole('button', { name: /Rejected\s*1/ }));
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('AMD');

    fireEvent.click(screen.getByRole('button', { name: /Cancelled\s*1/ }));
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('NVDA');

    fireEvent.click(screen.getByRole('button', { name: /Other\s*1/ }));
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('META');
  });

  it('searches visible order fields and clears an empty result', () => {
    renderOrders();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search orders' }), {
      target: { value: 'not-present' },
    });
    expect(screen.getByTestId('order-management-empty-state')).toHaveTextContent(
      'No matching orders',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('order-table-view')).toHaveTextContent('ACGL');
  });

  it('exports the filtered order view and announces the deterministic filename', () => {
    const createObjectURL = vi.fn(() => 'blob:orders');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderOrders();

    fireEvent.click(screen.getByRole('button', { name: /Filled\s*1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('orders-2026-07-30.csv');
  });

  it('explains empty history without claiming it never existed', () => {
    const payload = { ...successFixture, openOrders: [] };
    renderOrders(payload);
    expect(screen.getByTestId('order-management-empty-state')).toHaveTextContent(
      'history is not available unless Manager publishes it',
    );
    expect(screen.getByTestId('order-timeline-empty-state')).toBeVisible();
  });
});
