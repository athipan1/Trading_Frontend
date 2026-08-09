import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

function fixture(name = 'success') {
  return JSON.parse(
    readFileSync(new URL(`../tests/fixtures/dashboard/${name}.json`, import.meta.url), 'utf8'),
  );
}

test('Phase 13 keeps the last good snapshot when a refresh returns malformed telemetry', async ({ page }) => {
  let requests = 0;
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    requests += 1;
    const payload = fixture();
    if (requests > 1) {
      payload.agents = [{ id: 'manager', health: 'healthy', cpuPercent: 101 }];
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.goto('/portfolio');
  await expect(page.getByText('ACGL').first()).toBeVisible();

  await page.getByRole('button', { name: 'รีเฟรชข้อมูล Dashboard' }).click();
  await expect(page.locator('.error-banner[role="alert"]')).toContainText('agents[0].cpuPercent');
  await expect(page.locator('.error-banner[role="alert"]')).toContainText('snapshot');
  await expect(page.getByText('ACGL').first()).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);
});
