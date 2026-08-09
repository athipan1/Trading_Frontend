import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../tests/fixtures/dashboard/${name}.json`, import.meta.url), 'utf8'));
}

async function mockSnapshot(page, payloadOrHandler) {
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    const payload = typeof payloadOrHandler === 'function' ? await payloadOrHandler(route) : payloadOrHandler;
    if (payload?.status) return route.fulfill(payload);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

async function useEnglish(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('trading-dashboard-language', 'en');
  });
}

test('connects all six Settings groups to display behavior', async ({ page }) => {
  await useEnglish(page);
  await mockSnapshot(page, fixture('success'));
  await page.goto('/settings');

  await expect(page.getByTestId('page-settings')).toBeVisible();
  await expect(page.getByTestId('settings-theme-group')).toBeVisible();
  await expect(page.getByTestId('settings-display-group')).toBeVisible();
  await expect(page.getByTestId('settings-refresh-group')).toBeVisible();
  await expect(page.getByTestId('settings-freshness-group')).toBeVisible();
  await expect(page.getByTestId('settings-privacy-group')).toBeVisible();
  await expect(page.getByTestId('settings-navigation-group')).toBeVisible();

  const root = page.locator('html');
  await page.getByLabel('Color theme').selectOption('dark');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(root).toHaveCSS('color-scheme', 'dark');

  await page.getByLabel('Color theme').selectOption('light');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 250, 252)');

  await page.getByLabel('Density').selectOption('compact');
  await expect(root).toHaveAttribute('data-density', 'compact');

  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await expect(root).toHaveAttribute('data-reduced-motion', 'true');
});

test('changes auto refresh to 5s and stops polling when switched Off', async ({ page }) => {
  await useEnglish(page);
  let requests = 0;
  await mockSnapshot(page, () => {
    requests += 1;
    return fixture('success');
  });
  await page.goto('/settings');
  await expect(page.getByTestId('page-settings')).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(1);

  await page.getByLabel('Auto refresh').selectOption('5');
  await expect(page.getByTestId('auto-refresh-status')).toContainText('5s');
  const beforePolling = requests;
  await expect.poll(() => requests, { timeout: 6_500 }).toBeGreaterThan(beforePolling);

  await page.getByLabel('Auto refresh').selectOption('0');
  await expect(page.getByTestId('auto-refresh-status')).toContainText('Off');
  const stoppedAt = requests;
  await page.waitForTimeout(5_500);
  expect(requests).toBe(stoppedAt);
});

test('does not request a snapshot on focus when Refresh on focus is Off', async ({ page }) => {
  await useEnglish(page);
  let requests = 0;
  await mockSnapshot(page, () => {
    requests += 1;
    return fixture('success');
  });
  await page.goto('/settings');
  await expect(page.getByTestId('page-settings')).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(1);

  await page.getByLabel('Auto refresh').selectOption('0');
  const focusSwitch = page.getByRole('switch', { name: 'Refresh when returning to the tab' });
  await focusSwitch.click();
  await expect(focusSwitch).toHaveAttribute('aria-checked', 'false');
  const beforeFocus = requests;

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(250);
  expect(requests).toBe(beforeFocus);
});

test('masks account values and position sizes without changing the source snapshot', async ({ page }) => {
  await useEnglish(page);
  await mockSnapshot(page, fixture('success'));
  await page.goto('/settings');

  const maskValues = page.getByRole('switch', { name: 'Mask account values' });
  await maskValues.click();
  await page.getByTestId('nav-overview').first().click();
  await expect(page.getByTestId('page-overview').locator('.metrics-grid')).toContainText('Masked');

  await page.getByTestId('nav-settings').first().click();
  await maskValues.click();
  const maskSizes = page.getByRole('switch', { name: 'Mask position sizes' });
  await maskSizes.click();
  await page.getByTestId('nav-portfolio').first().click();

  const acglRow = page.getByTestId('position-table-view').getByRole('row').filter({ hasText: 'ACGL' });
  await expect(acglRow).toContainText('Masked');
  await expect(acglRow).toContainText('$');
});

test('uses /risk as the saved default landing page after navigation and reload', async ({ page }) => {
  await useEnglish(page);
  await mockSnapshot(page, fixture('success'));
  await page.goto('/settings');

  await page.getByLabel('Default landing page').selectOption('risk');
  await page.goto('/');
  await expect(page).toHaveURL(/\/risk$/);
  await expect(page.getByTestId('page-risk')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/risk$/);
  await expect(page.getByTestId('page-risk')).toBeVisible();
});
