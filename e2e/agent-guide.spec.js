import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../tests/fixtures/dashboard/${name}.json`, import.meta.url), 'utf8'));
}

async function mockSnapshot(page) {
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture('success')),
    });
  });
}

test('opens Agent Guide from navigation and explains agent rules in natural language', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('trading-dashboard-language', 'en');
  });
  await mockSnapshot(page);
  await page.goto('/agents');

  await page.getByTestId('nav-agent-guide').first().click();
  await expect(page).toHaveURL(/\/agent-guide$/);
  await expect(page.getByTestId('page-agent-guide')).toBeVisible();
  await expect(page.getByTestId('agent-guide-card-manager')).toBeVisible();
  await expect(page.getByTestId('agent-guide-card-backtest')).toBeVisible();

  await page.getByTestId('agent-guide-search').fill('emergency halt');
  await expect(page.getByTestId('agent-guide-card-risk')).toBeVisible();
  await expect(page.getByTestId('agent-guide-card-scanner')).toHaveCount(0);
  await expect(page.getByTestId('agent-guide-detail')).toContainText('Emergency halt must be checked at runtime');
});

test('keeps Agent Guide usable without horizontal overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem('trading-dashboard-language', 'th');
  });
  await mockSnapshot(page);
  await page.goto('/agent-guide');

  await expect(page.getByTestId('page-agent-guide')).toBeVisible();
  await expect(page.getByTestId('agent-flow-stage-protect')).toBeVisible();
  await page.getByTestId('agent-guide-card-profit').click();
  await expect(page.getByTestId('agent-guide-detail')).toContainText('ห้ามเรียก Execution_Agent โดยตรง');

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
});
