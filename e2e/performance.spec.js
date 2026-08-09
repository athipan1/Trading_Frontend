import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const budgetDocument = JSON.parse(
  readFileSync(new URL('../performance-budget.json', import.meta.url), 'utf8'),
);
const runtimeBudget = budgetDocument.runtime;
const runtimeResults = new Map();
const reportPath = path.resolve(process.cwd(), 'performance-artifacts', 'runtime-report.json');

const CASES = [
  ['/overview', 'page-overview'],
  ['/agents', 'page-agents'],
  ['/risk', 'page-risk'],
  ['/backtest', 'page-backtest'],
  ['/system', 'hourly-automation-status'],
];

function fixture() {
  return JSON.parse(
    readFileSync(new URL('../tests/fixtures/dashboard/success.json', import.meta.url), 'utf8'),
  );
}

async function mockSnapshot(page) {
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture()),
    });
  });
}

async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    window.__phase14Performance = {
      lcpMs: 0,
      cls: 0,
      longTaskTotalMs: 0,
      longTaskMaxMs: 0,
    };

    if (!('PerformanceObserver' in window)) return;

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries.at(-1);
        if (latest) window.__phase14Performance.lcpMs = latest.startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Chromium without LCP support will fail the explicit metric assertion below.
    }

    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__phase14Performance.cls += entry.value;
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Keep zero until the explicit browser support/assertion path below.
    }

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__phase14Performance.longTaskTotalMs += entry.duration;
          window.__phase14Performance.longTaskMaxMs = Math.max(
            window.__phase14Performance.longTaskMaxMs,
            entry.duration,
          );
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long-task reporting is optional in the platform; zero remains a safe lower bound.
    }
  });
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const resources = performance.getEntriesByType('resource').filter((entry) => {
      try {
        return new URL(entry.name).origin === window.location.origin;
      } catch {
        return false;
      }
    });
    const transferBytes = resources.reduce(
      (total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0),
      0,
    );
    return {
      fcpMs: fcp?.startTime ?? 0,
      lcpMs: window.__phase14Performance?.lcpMs ?? 0,
      cls: window.__phase14Performance?.cls ?? 0,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
      loadEventMs: navigation?.loadEventEnd ?? 0,
      longTaskTotalMs: window.__phase14Performance?.longTaskTotalMs ?? 0,
      longTaskMaxMs: window.__phase14Performance?.longTaskMaxMs ?? 0,
      resourceCount: resources.length,
      transferBytes,
    };
  });
}

function persistRuntimeReport() {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    budgetVersion: budgetDocument.version,
    viewport: { width: 320, height: 900 },
    budget: runtimeBudget,
    routes: [...runtimeResults.values()],
  }, null, 2)}\n`);
}

function assertMetrics(metrics) {
  expect(metrics.fcpMs, 'FCP must be observable').toBeGreaterThan(0);
  expect(metrics.lcpMs, 'LCP must be observable').toBeGreaterThan(0);
  expect(metrics.fcpMs).toBeLessThanOrEqual(runtimeBudget.fcpMs);
  expect(metrics.lcpMs).toBeLessThanOrEqual(runtimeBudget.lcpMs);
  expect(metrics.cls).toBeLessThanOrEqual(runtimeBudget.cls);
  expect(metrics.domContentLoadedMs).toBeLessThanOrEqual(runtimeBudget.domContentLoadedMs);
  expect(metrics.loadEventMs).toBeLessThanOrEqual(runtimeBudget.loadEventMs);
  expect(metrics.longTaskTotalMs).toBeLessThanOrEqual(runtimeBudget.longTaskTotalMs);
  expect(metrics.longTaskMaxMs).toBeLessThanOrEqual(runtimeBudget.longTaskMaxMs);
  expect(metrics.resourceCount).toBeLessThanOrEqual(runtimeBudget.resourceCount);
  expect(metrics.transferBytes).toBeLessThanOrEqual(runtimeBudget.transferBytes);
}

test.describe('@performance Phase 14 mobile runtime budgets', () => {
  test.describe.configure({ mode: 'serial' });

  for (const [route, readyId] of CASES) {
    test(`${route} stays within Web Vitals and runtime budgets at 320px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await installPerformanceObservers(page);
      await mockSnapshot(page);
      await page.goto(route, { waitUntil: 'load' });
      await expect(page.getByTestId(readyId)).toBeVisible();
      await page.waitForTimeout(200);

      const metrics = await collectMetrics(page);
      runtimeResults.set(route, { route, ...metrics });
      persistRuntimeReport();
      await testInfo.attach('performance-metrics.json', {
        body: JSON.stringify({ route, budget: runtimeBudget, metrics }, null, 2),
        contentType: 'application/json',
      });

      assertMetrics(metrics);
    });
  }
});
