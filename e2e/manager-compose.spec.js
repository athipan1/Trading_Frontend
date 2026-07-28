import { expect, test } from '@playwright/test';

const apiDown = process.env.EXPECT_API_DOWN === 'true';

test('loads the real Manager snapshot through the same-origin proxy', async ({ page }) => {
  test.skip(apiDown, 'API-down phase runs separately');
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByTestId('data-source')).toContainText('manager-api');
  await expect(page.getByTestId('trading-mode')).toHaveText('PAPER');
  await expect(page.getByTestId('schema-version')).toContainText('dashboard-snapshot.v1');
  await expect(page.getByTestId('schema-version')).toContainText('web-control.v1');

  await page.getByRole('button', { name: 'ภาพรวมระบบ' }).click();
  await expect(page.getByText('Cash').first()).toBeVisible();
  await expect(page.getByText('Equity').first()).toBeVisible();
  await expect(page.getByText('Open Orders').first()).toBeVisible();

  const refreshResponse = page.waitForResponse((response) => response.url().endsWith('/api/dashboard/snapshot'));
  await page.getByRole('button', { name: /refresh/i }).click();
  expect((await refreshResponse).status()).toBe(200);
  await page.getByRole('button', { name: 'Switch language' }).click();
  await expect(page.getByRole('heading', { name: 'แดชบอร์ดพอร์ตลงทุน' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('shows an error without crashing when Manager is unavailable', async ({ page }) => {
  test.skip(!apiDown, 'Happy-path phase runs separately');
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('data-source')).toContainText('manager-api');
  await page.getByRole('button', { name: 'ภาพรวมระบบ' }).click();
  await expect(page.getByText('Cash').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
