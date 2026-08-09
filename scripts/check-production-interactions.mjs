import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import {
  approvedProductionUrl,
  evaluateRuntimeHealth,
  hasHorizontalOverflow,
  isMonitoredRequestUrl,
} from './check-production-routes.mjs';

const MANAGER_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';
const DEFAULT_TIMEOUT_MS = 30_000;
const PREFERENCES_KEY = 'trading-dashboard-preferences';

export const PRODUCTION_INTERACTION_CASES = Object.freeze([
  'desktop-navigation-history',
  'manual-refresh',
  'settings-persistence-reset',
  'mobile-more-navigation',
]);

const ROUTE_READY_IDS = Object.freeze({
  overview: 'page-overview',
  portfolio: 'page-portfolio',
  orders: 'page-orders',
  agents: 'page-agents',
  risk: 'page-risk',
  backtest: 'page-backtest',
  system: 'hourly-automation-status',
  settings: 'page-settings',
});

function sanitizeMessage(value) {
  return (value instanceof Error ? value.message : String(value))
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function interactionRouteUrl(targetUrl, routePath, caseName) {
  const url = new URL(targetUrl);
  url.pathname = routePath;
  url.search = `interaction-smoke=${Date.now()}-${encodeURIComponent(caseName)}`;
  return url;
}

export function isSafePreferenceRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const serialized = JSON.stringify(value);
  return !/(operator.?token|api.?key|secret|password|credential)/i.test(serialized);
}

async function waitForReady(page, route, timeoutMs) {
  const readyId = ROUTE_READY_IDS[route];
  if (!readyId) throw new Error(`Unknown public route: ${route}`);
  await page.getByTestId('data-source').waitFor({ state: 'visible', timeout: timeoutMs });
  await page.getByTestId('trading-mode').waitFor({ state: 'visible', timeout: timeoutMs });
  await page.getByTestId(readyId).waitFor({ state: 'visible', timeout: timeoutMs });
  const source = (await page.getByTestId('data-source').textContent())?.trim() ?? '';
  if (!source.includes('public-snapshot')) throw new Error(`Unsafe data source: ${source || '(empty)'}`);
  const operatorInputs = await page.locator('input[placeholder="ใส่ WEB_CONTROL_OPERATOR_TOKEN"]').count();
  if (operatorInputs !== 0) throw new Error('Operator controls are exposed in production public-snapshot mode');
}

function attachRuntimeObservers(page, productionOrigin) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const snapshotStatuses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(sanitizeMessage(error)));
  page.on('requestfailed', (request) => {
    if (!isMonitoredRequestUrl(request.url(), productionOrigin)) return;
    requestFailures.push(`${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown failure'})`);
  });
  page.on('response', (response) => {
    if (response.url().split('?')[0] === MANAGER_SNAPSHOT_URL) snapshotStatuses.push(response.status());
  });

  return {
    snapshotStatuses,
    assertClean() {
      if (!snapshotStatuses.length) throw new Error('Manager_Agent public snapshot was not requested');
      if (snapshotStatuses.some((status) => status !== 200)) {
        throw new Error(`Manager_Agent snapshot returned non-200 status: ${snapshotStatuses.join(', ')}`);
      }
      return evaluateRuntimeHealth({ consoleErrors, pageErrors, requestFailures });
    },
  };
}

async function captureDimensions(page) {
  return page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body?.scrollWidth ?? 0,
  }));
}

async function runCase({ browser, targetUrl, timeoutMs, artifactDirectory, name, viewport, execute }) {
  const context = await browser.newContext({
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport,
  });
  const page = await context.newPage();
  const runtime = attachRuntimeObservers(page, targetUrl.origin);
  const screenshotsDirectory = `${artifactDirectory}/interactions`;
  await mkdir(screenshotsDirectory, { recursive: true });

  try {
    const details = await execute({ page, timeoutMs });
    const runtimeResult = runtime.assertClean();
    const dimensions = await captureDimensions(page);
    if (hasHorizontalOverflow(dimensions)) {
      throw new Error(
        `Horizontal overflow: document=${dimensions.documentWidth}, body=${dimensions.bodyWidth}, viewport=${dimensions.viewportWidth}`,
      );
    }
    const screenshot = `${screenshotsDirectory}/${name}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      name,
      status: 'passed',
      viewport,
      runtime: runtimeResult,
      dimensions,
      screenshot,
      ...details,
    };
  } catch (error) {
    const screenshot = `${screenshotsDirectory}/${name}-failure.png`;
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    return {
      name,
      status: 'failed',
      viewport,
      error: sanitizeMessage(error),
      screenshot,
    };
  } finally {
    await context.close();
  }
}

async function desktopNavigationCase({ browser, targetUrl, timeoutMs, artifactDirectory }) {
  return runCase({
    browser,
    targetUrl,
    timeoutMs,
    artifactDirectory,
    name: 'desktop-navigation-history',
    viewport: { width: 1280, height: 900 },
    execute: async ({ page }) => {
      await page.goto(interactionRouteUrl(targetUrl, '/overview', 'desktop-navigation-history').toString(), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
      await waitForReady(page, 'overview', timeoutMs);

      const visited = ['overview'];
      for (const route of ['portfolio', 'orders', 'agents', 'risk', 'backtest', 'system', 'settings']) {
        const nav = page.getByTestId(`nav-${route}`).first();
        await nav.click();
        await page.waitForURL((url) => url.pathname === `/${route}`, { timeout: timeoutMs });
        await waitForReady(page, route, timeoutMs);
        if ((await nav.getAttribute('aria-current')) !== 'page') {
          throw new Error(`Navigation did not mark ${route} as the current page`);
        }
        visited.push(route);
      }

      await page.goBack({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForURL((url) => url.pathname === '/system', { timeout: timeoutMs });
      await waitForReady(page, 'system', timeoutMs);
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForURL((url) => url.pathname === '/settings', { timeout: timeoutMs });
      await waitForReady(page, 'settings', timeoutMs);

      return { visitedRoutes: visited, historyRoundTrip: true };
    },
  });
}

async function manualRefreshCase({ browser, targetUrl, timeoutMs, artifactDirectory }) {
  return runCase({
    browser,
    targetUrl,
    timeoutMs,
    artifactDirectory,
    name: 'manual-refresh',
    viewport: { width: 1280, height: 900 },
    execute: async ({ page }) => {
      await page.goto(interactionRouteUrl(targetUrl, '/overview', 'manual-refresh').toString(), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
      await waitForReady(page, 'overview', timeoutMs);
      const refreshResponse = page.waitForResponse(
        (response) => response.url().split('?')[0] === MANAGER_SNAPSHOT_URL,
        { timeout: timeoutMs },
      );
      const button = page.locator('.header-refresh-button');
      await button.click();
      const response = await refreshResponse;
      if (response.status() !== 200) throw new Error(`Manual refresh returned HTTP ${response.status()}`);
      await button.waitFor({ state: 'visible', timeout: timeoutMs });
      if (await button.isDisabled()) {
        await page.waitForFunction(() => !document.querySelector('.header-refresh-button')?.disabled, null, { timeout: timeoutMs });
      }
      return { refreshStatus: response.status() };
    },
  });
}

async function settingsPersistenceCase({ browser, targetUrl, timeoutMs, artifactDirectory }) {
  return runCase({
    browser,
    targetUrl,
    timeoutMs,
    artifactDirectory,
    name: 'settings-persistence-reset',
    viewport: { width: 1280, height: 900 },
    execute: async ({ page }) => {
      await page.goto(interactionRouteUrl(targetUrl, '/settings', 'settings-persistence-reset').toString(), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
      await waitForReady(page, 'settings', timeoutMs);

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
      if (!isSafePreferenceRecord(persisted)) throw new Error('Unsafe field detected in persisted preferences');
      const expected = {
        theme: 'dark',
        density: 'compact',
        reducedMotion: true,
        refreshInterval: 0,
        refreshOnFocus: false,
        staleWarningSeconds: 300,
        maskAccountValues: true,
        maskPositionSizes: true,
        defaultPage: 'risk',
      };
      for (const [key, value] of Object.entries(expected)) {
        if (persisted?.[key] !== value) throw new Error(`Preference ${key} did not persist`);
      }

      await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await waitForReady(page, 'settings', timeoutMs);
      const rootState = await page.locator('html').evaluate((element) => ({
        theme: element.dataset.theme,
        density: element.dataset.density,
        reducedMotion: element.dataset.reducedMotion,
      }));
      if (rootState.theme !== 'dark' || rootState.density !== 'compact' || rootState.reducedMotion !== 'true') {
        throw new Error(`Display preferences did not survive reload: ${JSON.stringify(rootState)}`);
      }
      if ((await page.getByTestId('settings-default-page-select').inputValue()) !== 'risk') {
        throw new Error('Default landing page did not survive reload');
      }

      await page.goto(targetUrl.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForURL((url) => url.pathname === '/risk', { timeout: timeoutMs });
      await waitForReady(page, 'risk', timeoutMs);

      await page.goto(new URL('/settings', targetUrl).toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await waitForReady(page, 'settings', timeoutMs);
      await page.getByTestId('settings-reset-button').click();
      await page.goto(targetUrl.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForURL((url) => url.pathname === '/overview', { timeout: timeoutMs });
      await waitForReady(page, 'overview', timeoutMs);

      return { persisted: true, resetToOverview: true, safePreferenceRecord: true };
    },
  });
}

async function mobileNavigationCase({ browser, targetUrl, timeoutMs, artifactDirectory }) {
  return runCase({
    browser,
    targetUrl,
    timeoutMs,
    artifactDirectory,
    name: 'mobile-more-navigation',
    viewport: { width: 320, height: 900 },
    execute: async ({ page }) => {
      await page.goto(interactionRouteUrl(targetUrl, '/overview', 'mobile-more-navigation').toString(), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
      await waitForReady(page, 'overview', timeoutMs);
      const moreButton = page.locator('button[aria-controls="mobile-more-navigation"]');
      await moreButton.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: timeoutMs });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached', timeout: timeoutMs });
      if (!(await moreButton.evaluate((element) => element === document.activeElement))) {
        throw new Error('Mobile More button did not regain focus after Escape');
      }

      await moreButton.click();
      const openDialog = page.getByRole('dialog');
      await openDialog.getByTestId('nav-risk').click();
      await page.waitForURL((url) => url.pathname === '/risk', { timeout: timeoutMs });
      await waitForReady(page, 'risk', timeoutMs);
      if (await page.getByRole('dialog').count()) throw new Error('Mobile More dialog remained open after navigation');

      return { escapeRestoredFocus: true, navigatedToRisk: true };
    },
  });
}

async function main() {
  const targetUrl = approvedProductionUrl(process.env.PRODUCTION_URL);
  const timeoutMs = positiveInteger(
    process.env.PRODUCTION_SMOKE_NAVIGATION_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    'PRODUCTION_SMOKE_NAVIGATION_TIMEOUT_MS',
  );
  const artifactDirectory = process.env.PRODUCTION_SMOKE_ARTIFACT_DIR || 'production-smoke-artifacts';
  await mkdir(artifactDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const interactionResults = [];

  try {
    const runners = [desktopNavigationCase, manualRefreshCase, settingsPersistenceCase, mobileNavigationCase];
    for (const runner of runners) {
      const result = await runner({ browser, targetUrl, timeoutMs, artifactDirectory });
      interactionResults.push(result);
      console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`);
    }
  } finally {
    await browser.close();
  }

  const failures = interactionResults.filter((result) => result.status === 'failed');
  const report = {
    connected: failures.length === 0,
    checkedAt: new Date().toISOString(),
    productionUrl: targetUrl.toString(),
    interactionsChecked: interactionResults.length,
    interactionsPassed: interactionResults.length - failures.length,
    interactionsFailed: failures.length,
    cases: PRODUCTION_INTERACTION_CASES,
    errors: failures.map(({ name, error }) => ({ name, message: error })),
    interactionResults,
  };
  await writeFile(`${artifactDirectory}/interaction-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.connected) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
