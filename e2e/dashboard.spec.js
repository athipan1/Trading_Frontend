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

test('uses the finance control menus and preserves the resilient portfolio dashboard', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  let requests = 0;
  let failRequests = false;
  await page.route('**/api/dashboard/snapshot', async (route) => {
    requests += 1;
    if (failRequests) return route.fulfill({ status: 503, body: 'unavailable' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) });
  });

  await page.goto('/');
  await expect(page.getByTestId('data-source')).toContainText('manager-api');
  await expect(page.getByTestId('trading-mode')).toHaveText('PAPER');
  await expect(page.getByRole('heading', { name: 'บันทึกรายรับรายจ่าย' })).toBeVisible();
  await expect(page.getByTestId('schema-version')).toContainText('dashboard-snapshot.v1');
  await expect(page.getByTestId('schema-version')).toContainText('web-control.v1');

  await page.getByRole('button', { name: /ภาพรวมระบบ/ }).click();
  await expect(page.getByText('AAPL').first()).toBeVisible();

  await page.getByRole('button', { name: /refresh/i }).click();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);

  const languageSwitcher = page.getByRole('button', { name: 'Switch language' });
  await languageSwitcher.click();
  await expect(languageSwitcher).toContainText('EN');
  expect(consoleErrors).toEqual([]);

  failRequests = true;
  await page.getByRole('button', { name: /รีเฟรช/ }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByText('AAPL').first()).toBeVisible();
  expect(consoleErrors).toHaveLength(1);
  expect(consoleErrors[0]).toMatch(/Failed to load resource.*503 \(Service Unavailable\)/);
});
