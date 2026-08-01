import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import executionFailureFixture from '../../tests/fixtures/dashboard/execution-failure.json';
import successFixture from '../../tests/fixtures/dashboard/success.json';
import { translations } from '../i18n.js';
import { normalizeSnapshot } from '../services/api.js';
import OrdersTable from './OrdersTable.jsx';
import PositionsTable from './PositionsTable.jsx';
import SignalsPanel from './SignalsPanel.jsx';

afterEach(cleanup);

function renderPortfolio(snapshot) {
  const t = translations.en;
  return render(
    <>
      <PositionsTable positions={snapshot.positions} openOrders={snapshot.openOrders} t={t} />
      <OrdersTable orders={snapshot.openOrders} t={t} />
      <SignalsPanel signals={snapshot.signals} t={t} />
    </>,
  );
}

describe('mobile portfolio experience', () => {
  it('renders a mobile position card and a clear action center for a protected position', () => {
    renderPortfolio(normalizeSnapshot(successFixture));

    expect(screen.getByTestId('portfolio-action-center')).toHaveTextContent('Portfolio protection looks complete');
    expect(screen.getByTestId('position-card-ACGL')).toHaveTextContent('ACGL');
    expect(screen.getByTestId('position-card-ACGL')).toHaveTextContent('Market value');
    expect(screen.queryByTestId('positions-empty-state')).not.toBeInTheDocument();
  });

  it('surfaces incomplete position and order protection in the action center', () => {
    const fixture = structuredClone(successFixture);
    fixture.positions[0].protection = {
      status: 'missing',
      hasStopLoss: false,
      hasTakeProfit: false,
      hasBracket: false,
    };
    fixture.openOrders[0].orderClass = 'simple';
    fixture.openOrders[0].stopLoss = false;

    renderPortfolio(normalizeSnapshot(fixture));

    const actionCenter = screen.getByTestId('portfolio-action-center');
    expect(actionCenter).toHaveTextContent('2 items need review');
    expect(actionCenter).toHaveTextContent('Position protection incomplete');
    expect(actionCenter).toHaveTextContent('Open order has no Stop Loss');
    expect(actionCenter).toHaveTextContent('ACGL');
  });

  it('renders explicit empty states for positions, orders, and signals', () => {
    renderPortfolio(normalizeSnapshot(executionFailureFixture));

    expect(screen.getByTestId('positions-empty-state')).toHaveTextContent('No open positions');
    expect(screen.getByTestId('orders-empty-state')).toHaveTextContent('No open orders');
    expect(screen.getByTestId('signals-empty-state')).toHaveTextContent('No advisory signals');
  });
});
