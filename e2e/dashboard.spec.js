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

test('uses route-aware navigation and hides unavailable control pages', async ({ page }) => {
  await mockSnapshot(page, fixture('success'));
  await page.goto('/overview');

  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByTestId('page-overview')).toBeVisible();
  await expect(page.getByTestId('nav-ledger')).toHaveCount(0);

  await page.getByTestId('nav-portfolio').first().click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByTestId('page-portfolio')).toBeVisible();

  await page.getByTestId('nav-system').first().click();
  await expect(page).toHaveURL(/\/system$/);
  await expect(page.getByTestId('hourly-automation-status')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByTestId('page-portfolio')).toBeVisible();
});

test('renders a successful hourly run with run link and keyboard refresh', async ({ page }) => {
  let requests = 0;
  await mockSnapshot(page, () => {
    requests += 1;
    return fixture('success');
  });
  await page.goto('/system');

  await expect(page.getByTestId('data-source')).toContainText('public-snapshot');
  await expect(page.getByRole('heading', { name: 'สถานะระบบเทรดรายชั่วโมง' })).toBeVisible();
  await expect(page.getByText('ALPACA_PAPER').first()).toBeVisible();
  await expect(page.getByText('Run #100')).toBeVisible();
  await expect(page.getByRole('link', { name: 'เปิด GitHub Actions run' })).toHaveAttribute(
    'href',
    'https://github.com/athipan1/Manager_Agent/actions/runs/123456789',
  );

  const refresh = page.getByRole('button', { name: 'รีเฟรชข้อมูล Dashboard' });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);
});

test('renders workflow failure and preserves the last successful run', async ({ page }) => {
  await mockSnapshot(page, fixture('workflow-failure'));
  await page.goto('/system');
  await expect(page.getByTestId('hourly-automation-status')).toContainText('failure');
  await expect(page.getByText('Hourly Auto Trading did not complete successfully.')).toBeVisible();
  await expect(page.getByTestId('hourly-automation-status')).toContainText('30 ก.ค. 2569 06:00:00');
});

test('renders cancelled workflow and stale warning states', async ({ page }) => {
  await mockSnapshot(page, fixture('cancelled'));
  await page.goto('/system');
  await expect(page.getByTestId('hourly-automation-status')).toContainText('cancelled');
  await expect(page.getByText('Hourly Auto Trading was cancelled before completion.')).toBeVisible();

  await page.unrouteAll({ behavior: 'wait' });
  await mockSnapshot(page, fixture('stale'));
  await page.getByRole('button', { name: 'รีเฟรชข้อมูล Dashboard' }).click();
  await expect(page.getByRole('alert')).toContainText('ข้อมูลเก่าเกินกำหนด');
});

test('keeps the previous snapshot when a refresh returns HTTP 500', async ({ page }) => {
  let requests = 0;
  await mockSnapshot(page, () => {
    requests += 1;
    if (requests > 1) return { status: 500, contentType: 'application/json', body: '{}' };
    return fixture('success');
  });
  await page.goto('/portfolio');
  await expect(page.getByText('ACGL').first()).toBeVisible();
  await page.getByRole('button', { name: 'รีเฟรชข้อมูล Dashboard' }).click();
  await expect(page.locator('.error-banner')).toContainText('HTTP 500');
  await expect(page.getByText('ACGL').first()).toBeVisible();
});

test('renders position cards and action center on a 320px portfolio view', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockSnapshot(page, fixture('success'));
  await page.goto('/portfolio');

  await expect(page.getByTestId('portfolio-action-center')).toContainText('การคุ้มครองพอร์ตครบถ้วน');
  await expect(page.getByTestId('position-card-ACGL')).toBeVisible();
  await expect(page.locator('.desktop-position-table')).toBeHidden();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
});

test('renders explicit portfolio empty states', async ({ page }) => {
  await mockSnapshot(page, fixture('execution-failure'));
  await page.goto('/portfolio');

  await expect(page.getByTestId('positions-empty-state')).toContainText('ยังไม่มี Position ที่เปิดอยู่');
  await expect(page.getByTestId('orders-empty-state')).toContainText('ไม่มี Open Order');
  await expect(page.getByTestId('signals-empty-state')).toContainText('ยังไม่มีสัญญาณแนะนำ');
});

test('is mobile-first at 320px with no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockSnapshot(page, fixture('masked'));
  await page.goto('/overview');
  await expect(page.getByText('Production อ่าน Snapshot สาธารณะ', { exact: false })).toBeVisible();
  await expect(page.getByTestId('nav-overview').last()).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole('button', { name: 'รีเฟรชข้อมูล Dashboard' })).toBeVisible();
});
