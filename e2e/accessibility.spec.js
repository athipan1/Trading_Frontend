import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const AXE_PATH = path.resolve(process.cwd(), '.cache', 'axe-core', 'axe.min.js');
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

function fixture(name) {
  const fixtureName = name === 'agent-telemetry' ? 'success' : name;
  const payload = JSON.parse(readFileSync(new URL(`../tests/fixtures/dashboard/${fixtureName}.json`, import.meta.url), 'utf8'));
  if (name === 'agent-telemetry') {
    payload.agents = [
      { id: 'manager_agent', health: 'healthy', status: 'running', latencyMs: 25, version: '2.4.1', cpuPercent: 17, memoryMb: 410, lastRunAt: '2026-07-30T00:00:00Z' },
      { id: 'risk_agent', health: 'degraded', status: 'candidate_rejected', latencyMs: 44, version: '2.0.7', cpuPercent: 20, memoryPercent: 41, lastRunAt: '2026-07-29T23:58:30Z' },
    ];
  }
  return payload;
}

async function mockSnapshot(page, payload) {
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
  }));
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
  expect(formatViolations(blocking), 'axe found serious or critical accessibility violations').toEqual([]);
}

const auditCases = [
  { route: '/overview', fixtureName: 'success', width: 1280, height: 900 },
  { route: '/portfolio', fixtureName: 'success', width: 1280, height: 900 },
  { route: '/orders', fixtureName: 'success', width: 1280, height: 900 },
  { route: '/agents', fixtureName: 'agent-telemetry', width: 1280, height: 900 },
  { route: '/risk', fixtureName: 'success', width: 1280, height: 900 },
  { route: '/system', fixtureName: 'execution-failure', width: 1280, height: 900 },
  { route: '/overview', fixtureName: 'success', width: 320, height: 800 },
  { route: '/portfolio', fixtureName: 'success', width: 320, height: 800 },
  { route: '/orders', fixtureName: 'success', width: 320, height: 900 },
  { route: '/agents', fixtureName: 'agent-telemetry', width: 320, height: 900 },
  { route: '/risk', fixtureName: 'success', width: 320, height: 900 },
  { route: '/system', fixtureName: 'execution-failure', width: 320, height: 800 },
];

test.describe('@a11y axe accessibility gate', () => {
  for (const auditCase of auditCases) {
    test(`${auditCase.route} passes axe at ${auditCase.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: auditCase.width, height: auditCase.height });
      await mockSnapshot(page, fixture(auditCase.fixtureName));
      await page.goto(auditCase.route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await runAxeAudit(page, testInfo);
    });
  }

  test('skip link and route changes preserve keyboard focus', async ({ page }) => {
    await mockSnapshot(page, fixture('success'));
    await page.goto('/overview');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'ข้ามไปยังเนื้อหาหลัก' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await page.getByTestId('nav-portfolio').first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'พอร์ตลงทุน' })).toBeFocused();
  });
});
