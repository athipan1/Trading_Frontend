import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const SNAPSHOT_PATTERN = 'https://snapshot.test/dashboard.json?*';
const PREFERENCES_KEY = 'trading-dashboard-preferences';

const PUBLIC_ROUTES = [
  ['overview', 'page-overview'],
  ['portfolio', 'page-portfolio'],
  ['orders', 'page-orders'],
  ['agents', 'page-agents'],
  ['risk', 'page-risk'],
  ['backtest', 'page-backtest'],
  ['system', 'hourly-automation-status'],
  ['settings', 'page-settings'],
];

function fixture(name = 'success') {
  return JSON.parse(
    readFileSync(new URL(`../tests/fixtures/dashboard/${name}.json`, import.meta.url), 'utf8'),
  );
}

async function mockSnapshot(page, handler = () => fixture()) {
  await page.route(SNAPSHOT_PATTERN, async (route) => {
    const result = await handler(route);
    if (result?.status && Object.hasOwn(result, 'body')) {
      await route.fulfill(result);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
}

async function useEnglish(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('trading-dashboard-language', 'en');
  });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('@interaction Phase 15 production interaction reliability', () => {
  test('desktop navigation keeps URL, active state, focus, and browser history in sync', async ({ page }) => {
    await useEnglish(page);
    await mockSnapshot(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/overview');

    for (const [route, readyId] of PUBLIC_ROUTES.slice(1)) {
      const nav = page.getByTestId(`nav-${route}`).first();
      await nav.click();
      await expect(page).toHaveURL(new RegExp(`/${route}$`));
      await expect(page.getByTestId(readyId)).toBeVisible();
      await expect(nav).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#main-content h1')).toBeFocused();
    }

    await page.goBack();
    await expect(page).toHaveURL(/\/system$/);
    await expect(page.getByTestId('hourly-automation-status')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('page-settings')).toBeVisible();
  });

  test('mobile More sheet traps focus, restores focus on Escape, and navigates without overflow', async ({ page }) => {
    await useEnglish(page);
    await mockSnapshot(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/overview');

    const moreButton = page.locator('button[aria-controls="mobile-more-navigation"]');
    await moreButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(moreButton).toBeFocused();

    await moreButton.click();
    const openDialog = page.getByRole('dialog');
    await openDialog.getByTestId('nav-risk').click();
    await expect(page).toHaveURL(/\/risk$/);
    await expect(page.getByTestId('page-risk')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#main-content h1')).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test('manual refresh issues one request and exposes the in-flight state without enabling polling', async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem('trading-dashboard-language', 'en');
      window.localStorage.setItem(key, JSON.stringify({
        version: 1,
        theme: 'system',
        density: 'comfortable',
        reducedMotion: false,
        refreshInterval: 0,
        refreshOnFocus: false,
        staleWarningSeconds: 120,
        maskAccountValues: false,
        maskPositionSizes: false,
        defaultPage: 'overview',
      }));
    }, PREFERENCES_KEY);

    let requests = 0;
    await mockSnapshot(page, async () => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      return fixture();
    });

    await page.goto('/overview');
    await expect(page.getByTestId('page-overview')).toBeVisible();
    const beforeRefresh = requests;

    const refreshButton = page.locator('.header-refresh-button');
    await refreshButton.click();
    await expect(refreshButton).toBeDisabled();
    await expect.poll(() => requests).toBe(beforeRefresh + 1);
    await expect(refreshButton).toBeEnabled();
    await page.waitForTimeout(300);
    expect(requests).toBe(beforeRefresh + 1);
  });

  test('all Settings groups persist across reload, privacy follows navigation, and reset restores defaults', async ({ page }) => {
    await useEnglish(page);
    await mockSnapshot(page);
    await page.goto('/settings');

    await page.getByTestId('settings-theme-select').selectOption('dark');
    await page.getByTestId('settings-density-select').selectOption('compact');
    await page.getByTestId('settings-reduced-motion-toggle').click();
    await page.getByTestId('settings-auto-refresh-select').selectOption('0');
    await page.getByTestId('settings-refresh-on-focus-toggle').click();
    await page.getByTestId('settings-stale-warning-input').fill('300');
    await page.getByTestId('settings-mask-account-values-toggle').click();
    await page.getByTestId('settings-mask-position-sizes-toggle').click();
    await page.getByTestId('settings-default-page-select').selectOption('risk');

    const persisted = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), PREFERENCES_KEY);
    expect(persisted).toMatchObject({
      version: 1,
      theme: 'dark',
      density: 'compact',
      reducedMotion: true,
      refreshInterval: 0,
      refreshOnFocus: false,
      staleWarningSeconds: 300,
      maskAccountValues: true,
      maskPositionSizes: true,
      defaultPage: 'risk',
    });
    expect(JSON.stringify(persisted)).not.toMatch(/token|secret|api[_-]?key/i);

    await page.reload();
    await expect(page.getByTestId('page-settings')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.getByTestId('settings-auto-refresh-select')).toHaveValue('0');
    await expect(page.getByTestId('settings-refresh-on-focus-toggle')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('settings-stale-warning-input')).toHaveValue('300');

    await page.getByTestId('nav-overview').first().click();
    await expect(page.getByTestId('page-overview').locator('.metrics-grid')).toContainText('Masked');

    await page.getByTestId('nav-portfolio').first().click();
    const acglRow = page.getByTestId('position-table-view').getByRole('row').filter({ hasText: 'ACGL' });
    await expect(acglRow).toContainText('Masked');

    await page.goto('/');
    await expect(page).toHaveURL(/\/risk$/);
    await expect(page.getByTestId('page-risk')).toBeVisible();

    await page.getByTestId('nav-settings').first().click();
    await page.getByTestId('settings-reset-button').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');
    await expect(page.getByTestId('settings-default-page-select')).toHaveValue('overview');

    await page.goto('/');
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByTestId('page-overview')).toBeVisible();
  });
});
