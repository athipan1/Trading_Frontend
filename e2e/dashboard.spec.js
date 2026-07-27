import { expect, test } from '@playwright/test';

const snapshot = {
  schemaVersion: 'dashboard-snapshot.v1',
  generatedAt: '2026-07-21T10:00:00Z',
  mode: 'PAPER',
  brokerMode: 'ALPACA',
  flow: 'portfolio_review',
  account: { cash: 10000, equity: 12000, buyingPower: 20000, status: 'ACTIVE', mode: 'PAPER' },
  positions: [{ symbol: 'AAPL', quantity: 2, averageCost: 100, currentPrice: 110, marketValue: 220, unrealizedPnL: 20 }],
  openOrders: [{ symbol: 'AAPL', side: 'sell', quantity: 2, orderClass: 'bracket', type: 'limit', status: 'new', takeProfit: 125, stopLoss: true }],
  curatorSignals: [],
  summary: { positionCount: 1, openOrderCount: 1 },
};

test('persists finance controls and preserves the resilient portfolio dashboard', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  let snapshotRequests = 0;
  let failSnapshotRequests = false;
  const persistedEntries = [
    {
      entry_id: 'entry-salary-1',
      account_id: '1',
      entry_type: 'income',
      amount: '30000.00',
      currency: 'THB',
      category: 'salary',
      description: 'monthly salary',
      occurred_at: '2026-07-01T12:00:00Z',
      created_at: '2026-07-01T12:00:00Z',
      updated_at: '2026-07-01T12:00:00Z',
    },
  ];

  await page.route('**/api/dashboard/snapshot', async (route) => {
    snapshotRequests += 1;
    if (failSnapshotRequests) return route.fulfill({ status: 503, body: 'unavailable' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) });
  });

  await page.route('**/api/web-control/capabilities', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'success',
      data: {
        schema_version: 'web-control.v1',
        trading_mode: 'PAPER',
        trading_enabled: true,
        manual_confirmation_required: true,
        execution_enabled: false,
        live_execution_enabled: false,
        finance_currency: 'THB',
        trade_currency: 'USD',
      },
    }),
  }));

  await page.route('**/api/web-control/finance-state?**', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'success',
      data: {
        account_id: '1',
        entries: persistedEntries,
        budgets: {
          account_id: '1',
          personal_investment_budget_thb: '5000.00',
          trade_plan_limit_usd: '250.00',
        },
      },
    }),
  }));

  await page.route('**/api/web-control/finance-entries', async (route) => {
    const body = route.request().postDataJSON();
    const created = {
      ...body,
      created_at: '2026-07-28T12:00:00Z',
      updated_at: '2026-07-28T12:00:00Z',
    };
    persistedEntries.unshift(created);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', data: created }),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('data-source')).toContainText('manager-api');
  await expect(page.getByTestId('trading-mode')).toHaveText('PAPER');
  await expect(page.getByRole('heading', { name: 'บันทึกรายรับรายจ่าย' })).toBeVisible();
  await expect(page.getByTestId('schema-version')).toContainText('dashboard-snapshot.v1');
  await expect(page.getByTestId('schema-version')).toContainText('web-control.v1');

  await page.getByPlaceholder('ใส่ WEB_CONTROL_OPERATOR_TOKEN').fill('test-operator-token');
  await page.getByRole('button', { name: 'เชื่อมต่อ Manager' }).click();
  await expect(page.getByText(/เชื่อมต่อแล้ว/)).toBeVisible();
  await expect(page.getByText('salary')).toBeVisible();

  await page.getByPlaceholder('จำนวนเงิน').fill('500');
  await page.getByPlaceholder('หมวดหมู่ เช่น อาหาร').fill('transport');
  await page.getByPlaceholder('รายละเอียด').fill('taxi');
  await page.getByRole('button', { name: 'เพิ่มรายการ' }).click();
  await expect(page.getByText('transport')).toBeVisible();
  expect(persistedEntries[0].amount).toBe('500.00');

  await page.getByRole('button', { name: /ภาพรวมระบบ/ }).click();
  await expect(page.getByText('AAPL').first()).toBeVisible();

  await page.getByRole('button', { name: /refresh/i }).click();
  await expect.poll(() => snapshotRequests).toBeGreaterThanOrEqual(2);

  const languageSwitcher = page.getByRole('button', { name: 'Switch language' });
  await languageSwitcher.click();
  await expect(languageSwitcher).toContainText('EN');
  expect(consoleErrors).toEqual([]);

  failSnapshotRequests = true;
  await page.getByRole('button', { name: /รีเฟรช/ }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByText('AAPL').first()).toBeVisible();
  expect(consoleErrors).toHaveLength(1);
  expect(consoleErrors[0]).toMatch(/Failed to load resource.*503 \(Service Unavailable\)/);
});
