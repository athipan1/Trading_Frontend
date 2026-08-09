import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SNAPSHOT_PATTERN = 'https://snapshot.test/dashboard.json?*';
const AXE_PATH = path.resolve(process.cwd(), '.cache', 'axe-core', 'axe.min.js');
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

function fixture(name = 'success') {
  return JSON.parse(
    readFileSync(new URL(`../tests/fixtures/dashboard/${name}.json`, import.meta.url), 'utf8'),
  );
}

async function mockJson(page, payload, status = 200) {
  await page.route(SNAPSHOT_PATTERN, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

async function mockRaw(page, { body, status = 200, contentType = 'application/json' }) {
  await page.route(SNAPSHOT_PATTERN, async (route) => {
    await route.fulfill({ status, contentType, body });
  });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport);
}

async function runAxeAudit(page, testInfo) {
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'],
    },
    resultTypes: ['violations', 'incomplete'],
  }));
  await testInfo.attach('axe-results.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact));
  expect(
    blocking.map(({ id, impact, help }) => ({ id, impact, help })),
    'axe found serious or critical accessibility violations',
  ).toEqual([]);
}

const RESILIENCE_ROUTES = [
  ['/overview', 'page-overview'],
  ['/agents', 'page-agents'],
  ['/risk', 'page-risk'],
  ['/backtest', 'page-backtest'],
  ['/system', 'hourly-automation-status'],
];

test.describe('Phase 13 snapshot transport and core contract failures', () => {
  for (const status of [404, 500]) {
    test(`HTTP ${status} fails closed without substituting mock portfolio data`, async ({ page }) => {
      await mockJson(page, {}, status);
      await page.goto('/overview');

      await expect(page.getByTestId('page-overview')).toBeVisible();
      await expect(page.getByTestId('data-source')).toContainText('public-snapshot');
      await expect(page.locator('.error-banner[role="alert"]')).toContainText(`HTTP ${status}`);
      await expect(page.getByText('ACGL', { exact: true })).toHaveCount(0);
    });
  }

  test('invalid JSON is reported without replacing the failed response with mock data', async ({ page }) => {
    await mockRaw(page, { body: '{"schemaVersion":', status: 200 });
    await page.goto('/overview');

    await expect(page.getByTestId('page-overview')).toBeVisible();
    await expect(page.locator('.error-banner[role="alert"]')).toContainText('not valid JSON');
    await expect(page.getByTestId('data-source')).toContainText('public-snapshot');
    await expect(page.getByText('ACGL', { exact: true })).toHaveCount(0);
  });

  test('unsupported schema is classified as malformed and remains fail-closed', async ({ page }) => {
    const payload = fixture();
    payload.schemaVersion = 'dashboard-snapshot.v999';
    await mockJson(page, payload);
    await page.goto('/overview');

    await expect(page.locator('.error-banner[role="alert"]')).toContainText('Unsupported dashboard schema');
    await expect(page.getByTestId('schema-version')).toContainText('dashboard-snapshot.v2');
    await expect(page.getByText('ACGL', { exact: true })).toHaveCount(0);
  });

  test('request timeout is surfaced explicitly and does not invent a fallback snapshot', async ({ page }) => {
    test.setTimeout(25_000);
    await page.route(SNAPSHOT_PATTERN, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 11_000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture()) }).catch(() => {});
    });
    await page.goto('/overview');

    await expect(page.locator('.error-banner[role="alert"]')).toContainText('timed out', { timeout: 15_000 });
    await expect(page.getByTestId('data-source')).toContainText('public-snapshot');
    await expect(page.getByText('ACGL', { exact: true })).toHaveCount(0);
  });
});

test.describe('Phase 13 optional telemetry quality states', () => {
  test('missing agents, risk, and backtest remain explicit unavailable states', async ({ page }) => {
    const payload = fixture();
    delete payload.agents;
    delete payload.risk;
    delete payload.backtest;
    await mockJson(page, payload);

    await page.goto('/agents');
    await expect(page.getByTestId('page-agents')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Agent telemetry');
    await expect(page.locator('.error-banner')).toHaveCount(0);

    await page.goto('/risk');
    await expect(page.getByTestId('page-risk')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('optional risk contract');
    await expect(page.locator('.error-banner')).toHaveCount(0);

    await page.goto('/backtest');
    await expect(page.getByTestId('page-backtest')).toBeVisible();
    await expect(page.getByTestId('backtest-history-empty')).toBeVisible();
    await expect(page.getByTestId('backtest-trades-empty')).toBeVisible();
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });

  test('malformed agent telemetry is rejected as malformed instead of silently becoming healthy', async ({ page }) => {
    const payload = fixture();
    payload.agents = [{ id: 'manager', health: 'healthy', cpuPercent: 101 }];
    await mockJson(page, payload);
    await page.goto('/agents');

    await expect(page.getByTestId('page-agents')).toBeVisible();
    await expect(page.locator('.error-banner[role="alert"]')).toContainText('agents[0].cpuPercent');
    await expect(page.getByTestId('agent-card-manager').locator('.agent-health-badge.unavailable')).toBeVisible();
  });

  test('malformed risk telemetry is rejected instead of fabricating a safe risk state', async ({ page }) => {
    const payload = fixture();
    payload.risk = { riskLevel: 'low', riskScore: 500, emergencyHalt: { active: false } };
    await mockJson(page, payload);
    await page.goto('/risk');

    await expect(page.getByTestId('page-risk')).toBeVisible();
    await expect(page.locator('.error-banner[role="alert"]')).toContainText('risk.riskScore');
    await expect(page.getByTestId('risk-level')).toHaveClass(/unavailable/);
  });

  test('malformed backtest telemetry is rejected instead of rendering invented history', async ({ page }) => {
    const payload = fixture();
    payload.backtest = { latestRun: null, history: 'not-an-array' };
    await mockJson(page, payload);
    await page.goto('/backtest');

    await expect(page.getByTestId('page-backtest')).toBeVisible();
    await expect(page.locator('.error-banner[role="alert"]')).toContainText('backtest.history');
    await expect(page.getByTestId('backtest-history-empty')).toBeVisible();
  });
});

test.describe('Phase 13 stale and mobile resilience', () => {
  for (const [route, readyId] of RESILIENCE_ROUTES) {
    test(`${route} remains usable at 320px when optional telemetry is unavailable`, async ({ page }) => {
      const payload = fixture();
      delete payload.agents;
      delete payload.risk;
      delete payload.backtest;
      await page.setViewportSize({ width: 320, height: 900 });
      await mockJson(page, payload);
      await page.goto(route);

      await expect(page.getByTestId(readyId)).toBeVisible();
      await expect(page.locator('.error-banner')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('stale Manager snapshot is surfaced as a warning while System remains usable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await mockJson(page, fixture('stale'));
    await page.goto('/system');

    await expect(page.getByTestId('hourly-automation-status')).toBeVisible();
    await expect(page.getByTestId('system-incident-summary')).toHaveAttribute('data-severity', 'warning');
    await expect(page.getByTestId('system-incident-summary')).toContainText('Snapshot เก่าเกินกำหนด');
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('@a11y Phase 13 resilience states', () => {
  test('initial HTTP failure state passes axe at 320px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await mockJson(page, {}, 500);
    await page.goto('/overview');
    await expect(page.locator('.error-banner[role="alert"]')).toBeVisible();
    await runAxeAudit(page, testInfo);
  });

  test('optional telemetry unavailable state passes axe at 320px', async ({ page }, testInfo) => {
    const payload = fixture();
    delete payload.risk;
    await page.setViewportSize({ width: 320, height: 900 });
    await mockJson(page, payload);
    await page.goto('/risk');
    await expect(page.getByRole('status')).toContainText('optional risk contract');
    await runAxeAudit(page, testInfo);
  });

  test('stale system warning state passes axe at 320px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await mockJson(page, fixture('stale'));
    await page.goto('/system');
    await expect(page.getByTestId('system-incident-summary')).toHaveAttribute('data-severity', 'warning');
    await runAxeAudit(page, testInfo);
  });
});
