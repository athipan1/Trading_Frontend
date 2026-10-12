import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

function snapshot() {
  return JSON.parse(readFileSync(
    new URL('../tests/fixtures/dashboard/success.json', import.meta.url),
    'utf8',
  ));
}

async function loadPortfolio(page, payload) {
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.goto('/portfolio');
  await expect(page.getByTestId('page-portfolio')).toBeVisible();
}

test('legacy snapshots retain unchanged visual layout with no invented ownership', async ({ page }) => {
  await loadPortfolio(page, snapshot());
  await expect(page.getByTestId('portfolio-ownership-boxes')).toHaveCount(0);
});

test('only Manager-published ownership creates read-only, filterable boxes', async ({ page }) => {
  const data = snapshot();
  const source = data.positions[0];
  data.positions = [
    { ...source, symbol: 'OXY', ownership: 'manual' },
    { ...source, symbol: 'MSFT', ownership: 'ai_managed' },
    { ...source, symbol: 'UNKN', ownership: 'unclassified' },
  ];
  await loadPortfolio(page, data);
  await expect(page.getByTestId('portfolio-ownership-boxes')).toBeVisible();
  await expect(page.getByTestId('ownership-box-manual')).toContainText('1');
  await expect(page.getByTestId('ownership-box-ai_managed')).toContainText('1');
  await expect(page.getByTestId('ownership-box-unclassified')).toContainText('1');

  await page.getByTestId('ownership-box-manual').click();
  await expect(page.getByTestId('ownership-box-manual')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('position-table-view')).toContainText('OXY');
  await expect(page.getByTestId('position-table-view')).not.toContainText('MSFT');

  await page.getByTestId('ownership-box-ai_managed').click();
  await expect(page.getByTestId('position-table-view')).toContainText('MSFT');
  await expect(page.getByTestId('position-table-view')).not.toContainText('OXY');

  await page.getByTestId('ownership-box-unclassified').click();
  await expect(page.getByTestId('position-table-view')).toContainText('UNKN');
  await expect(page.getByTestId('position-table-view')).not.toContainText('MSFT');
  await expect(page.getByRole('button', { name: /place order|ส่งออเดอร์|execute trade/i })).toHaveCount(0);
});
