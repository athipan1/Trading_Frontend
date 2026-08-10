import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const DEFAULT_URL = 'https://trading-frontend-wheat-pi.vercel.app/';
const MANAGER_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const ALLOWED_RUNTIME_MODES = new Set(['PAPER', 'SIMULATOR']);

export const PRODUCTION_ROUTES = Object.freeze([
  { path: '/overview', readyTestId: 'page-overview' },
  { path: '/portfolio', readyTestId: 'page-portfolio' },
  { path: '/orders', readyTestId: 'page-orders' },
  { path: '/agents', readyTestId: 'page-agents' },
  { path: '/risk', readyTestId: 'page-risk' },
  { path: '/backtest', readyTestId: 'page-backtest' },
  { path: '/system', readyTestId: 'hourly-automation-status' },
  { path: '/settings', readyTestId: 'page-settings' },
]);

export const PRODUCTION_VIEWPORTS = Object.freeze([
  { name: 'mobile-320', width: 320, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 900 },
]);

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function approvedProductionUrl(value) {
  const url = new URL(value || DEFAULT_URL);
  if (url.protocol !== 'https:') throw new Error('Production URL must use HTTPS');
  if (url.hostname !== 'trading-frontend-wheat-pi.vercel.app') {
    throw new Error('Production URL must be trading-frontend-wheat-pi.vercel.app');
  }
  if (url.username || url.password || url.hash) {
    throw new Error('Production URL must not contain credentials or fragments');
  }
  url.pathname = '/';
  url.search = '';
  return url;
}

function sanitizeMessage(value) {
  return (value instanceof Error ? value.message : String(value))
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function uniqueMessages(values) {
  return [...new Set(values.map(sanitizeMessage).filter(Boolean))];
}

export function hasHorizontalOverflow({ viewportWidth, documentWidth, bodyWidth = 0 }) {
  return Math.max(Number(documentWidth) || 0, Number(bodyWidth) || 0)
    > (Number(viewportWidth) || 0) + 1;
}

export function isMonitoredRequestUrl(value, productionOrigin) {
  try {
    const url = new URL(value);
    return url.origin === productionOrigin || url.toString().split('?')[0] === MANAGER_SNAPSHOT_URL;
  } catch {
    return false;
  }
}

export function requiresReadOnlyBanner(routePath) {
  return routePath === '/overview';
}

export function requiresTradingObservability(routePath) {
  return routePath === '/system';
}

export function isAllowedRuntimeMode(value) {
  return ALLOWED_RUNTIME_MODES.has(String(value || '').trim().toUpperCase());
}

export function evaluateRuntimeHealth({ consoleErrors = [], pageErrors = [], requestFailures = [] } = {}) {
  const normalized = {
    consoleErrors: uniqueMessages(consoleErrors),
    pageErrors: uniqueMessages(pageErrors),
    requestFailures: uniqueMessages(requestFailures),
  };
  const total = normalized.consoleErrors.length + normalized.pageErrors.length + normalized.requestFailures.length;
  if (total > 0) {
    const samples = [
      ...normalized.consoleErrors.map((message) => `console.error: ${message}`),
      ...normalized.pageErrors.map((message) => `pageerror: ${message}`),
      ...normalized.requestFailures.map((message) => `requestfailed: ${message}`),
    ].slice(0, 8);
    throw new Error(`Production runtime reported ${total} issue(s): ${samples.join(' | ')}`);
  }
  return { ...normalized, total };
}

function routeUrl(targetUrl, routePath, viewportName) {
  const url = new URL(targetUrl);
  url.pathname = routePath;
  url.search = `route-smoke=${Date.now()}-${encodeURIComponent(viewportName)}`;
  return url;
}

async function waitForRuntimeMode(page, navigationTimeoutMs) {
  const mode = page.getByTestId('trading-mode');
  const deadline = Date.now() + navigationTimeoutMs;
  while (Date.now() < deadline) {
    const value = (await mode.textContent())?.trim().toUpperCase() ?? '';
    if (isAllowedRuntimeMode(value)) return value;
    await page.waitForTimeout(100);
  }
  const finalValue = (await mode.textContent())?.trim().toUpperCase() ?? '';
  throw new Error(`Runtime mode did not become PAPER or SIMULATOR before timeout: ${finalValue || '(empty)'}`);
}

async function waitForRoute(page, route, navigationTimeoutMs) {
  await page.getByTestId('data-source').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
  await page.getByTestId('schema-version').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
  await page.getByTestId('trading-mode').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
  await waitForRuntimeMode(page, navigationTimeoutMs);
  await page.getByTestId(route.readyTestId).waitFor({ state: 'visible', timeout: navigationTimeoutMs });
  if (requiresTradingObservability(route.path)) {
    await page.getByTestId('trading-observability-panel').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await page.getByTestId('observability-stage-list').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await page.getByTestId('decision-analytics-panel').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await page.getByTestId('decision-analytics-funnel').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await page.getByTestId('decision-history-panel').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await page.getByTestId('decision-history-cycle-list').waitFor({ state: 'visible', timeout: navigationTimeoutMs });
  }
  await page.evaluate(async () => {
    await document.fonts?.ready;
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function verifyCommonProductionBoundary(page, { requireReadOnlyBanner = false } = {}) {
  const dataSourceText = (await page.getByTestId('data-source').textContent())?.trim() ?? '';
  const schemaText = (await page.getByTestId('schema-version').textContent())?.trim() ?? '';
  const runtimeModeText = (await page.getByTestId('trading-mode').textContent())?.trim().toUpperCase() ?? '';
  const errorBannerTexts = await page.locator('.error-banner[role="alert"]').allTextContents();
  const staleBannerCount = await page.locator('.stale-banner[role="alert"]').count();
  const operatorInputCount = await page.locator('input[placeholder="ใส่ WEB_CONTROL_OPERATOR_TOKEN"]').count();
  const readOnlyBannerCount = await page.locator('[aria-label="Read-only public snapshot mode"]').count();

  if (!dataSourceText.includes('public-snapshot')) {
    throw new Error(`Data source is not public-snapshot: ${dataSourceText || '(empty)'}`);
  }
  if (!schemaText.includes('dashboard-snapshot.v2')) {
    throw new Error(`Schema is not dashboard-snapshot.v2: ${schemaText || '(empty)'}`);
  }
  if (!isAllowedRuntimeMode(runtimeModeText)) {
    throw new Error(`Runtime mode must be PAPER or SIMULATOR: ${runtimeModeText || '(empty)'}`);
  }
  if (operatorInputCount !== 0) throw new Error('Operator token control is exposed in public snapshot mode');
  if (requireReadOnlyBanner && readOnlyBannerCount !== 1) {
    throw new Error('Read-only public snapshot banner is missing from the Overview route');
  }
  if (!requireReadOnlyBanner && readOnlyBannerCount > 1) {
    throw new Error('Read-only public snapshot banner is duplicated');
  }
  if (errorBannerTexts.some((text) => text.trim())) {
    throw new Error(`Application error banner visible: ${errorBannerTexts.join(' | ')}`);
  }

  return {
    dataSourceText,
    schemaText,
    runtimeModeText,
    readOnlyBannerVisible: readOnlyBannerCount > 0,
    staleDataVisible: staleBannerCount > 0,
  };
}

async function inspectRoute({ browser, targetUrl, route, viewport, navigationTimeoutMs, artifactDirectory }) {
  const context = await browser.newContext({
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  let managerSnapshotStatus = null;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(sanitizeMessage(error)));
  page.on('requestfailed', (request) => {
    if (!isMonitoredRequestUrl(request.url(), targetUrl.origin)) return;
    requestFailures.push(`${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown failure'})`);
  });
  page.on('response', (response) => {
    if (response.url().split('?')[0] === MANAGER_SNAPSHOT_URL) managerSnapshotStatus = response.status();
  });

  try {
    const response = await page.goto(routeUrl(targetUrl, route.path, viewport.name).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });
    if (!response) throw new Error('Route did not return an HTTP response');
    if (response.status() >= 400) throw new Error(`Route returned HTTP ${response.status()}`);

    await waitForRoute(page, route, navigationTimeoutMs);
    const boundary = await verifyCommonProductionBoundary(page, {
      requireReadOnlyBanner: requiresReadOnlyBanner(route.path),
    });
    if (managerSnapshotStatus === null) throw new Error('Manager_Agent public snapshot was not requested');
    if (managerSnapshotStatus !== 200) throw new Error(`Manager_Agent snapshot returned HTTP ${managerSnapshotStatus}`);

    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body?.scrollWidth ?? 0,
    }));
    if (hasHorizontalOverflow(dimensions)) {
      throw new Error(
        `Horizontal overflow: document=${dimensions.documentWidth}, body=${dimensions.bodyWidth}, viewport=${dimensions.viewportWidth}`,
      );
    }

    const observability = requiresTradingObservability(route.path)
      ? {
          visible: true,
          correlationId: (await page.getByTestId('observability-correlation').locator('code').textContent())?.trim() || null,
          stageCount: await page.getByTestId('observability-stage-list').locator('li').count(),
          candidateCount: await page.locator('[data-testid^="observability-candidate-"]').count(),
          analyticsStatus: (await page.getByTestId('decision-analytics-status').textContent())?.trim() || null,
          analyticsAlertCount: await page.locator('[data-testid^="decision-analytics-alert-"]').count(),
          analyticsFunnelStageCount: await page.getByTestId('decision-analytics-funnel').locator('li').count(),
          historyCycleCount: await page.getByTestId('decision-history-cycle-list').locator('button').count(),
        }
      : null;
    if (observability && observability.stageCount !== 7) {
      throw new Error(`Trading observability must render exactly 7 stages; received ${observability.stageCount}`);
    }
    if (observability && !observability.correlationId) {
      throw new Error('Trading observability correlation ID is missing');
    }
    if (observability && !observability.analyticsStatus) {
      throw new Error('Decision analytics overall status is missing');
    }
    if (observability && observability.analyticsFunnelStageCount !== 7) {
      throw new Error(`Decision analytics must render exactly 7 funnel stages; received ${observability.analyticsFunnelStageCount}`);
    }
    if (observability && (observability.historyCycleCount < 1 || observability.historyCycleCount > 24)) {
      throw new Error(`Decision history must render 1-24 cycles; received ${observability.historyCycleCount}`);
    }

    const runtime = evaluateRuntimeHealth({ consoleErrors, pageErrors, requestFailures });
    const screenshotDirectory = `${artifactDirectory}/routes/${viewport.name}`;
    await mkdir(screenshotDirectory, { recursive: true });
    const screenshot = `${screenshotDirectory}/${route.path.slice(1)}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });

    return {
      route: route.path,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      status: 'passed',
      pageStatus: response.status(),
      managerSnapshotStatus,
      overflow: false,
      dimensions,
      runtime,
      observability,
      readOnlyBannerVisible: boundary.readOnlyBannerVisible,
      staleDataVisible: boundary.staleDataVisible,
      screenshot,
    };
  } catch (error) {
    const failureDirectory = `${artifactDirectory}/routes/${viewport.name}`;
    await mkdir(failureDirectory, { recursive: true });
    const screenshot = `${failureDirectory}/${route.path.slice(1)}-failure.png`;
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    return {
      route: route.path,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      status: 'failed',
      error: sanitizeMessage(error),
      screenshot,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const targetUrl = approvedProductionUrl(process.env.PRODUCTION_URL);
  const navigationTimeoutMs = positiveInteger(
    process.env.PRODUCTION_SMOKE_NAVIGATION_TIMEOUT_MS,
    DEFAULT_NAVIGATION_TIMEOUT_MS,
    'PRODUCTION_SMOKE_NAVIGATION_TIMEOUT_MS',
  );
  const artifactDirectory = process.env.PRODUCTION_SMOKE_ARTIFACT_DIR || 'production-smoke-artifacts';
  await mkdir(artifactDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const routeResults = [];
  try {
    for (const viewport of PRODUCTION_VIEWPORTS) {
      for (const route of PRODUCTION_ROUTES) {
        const result = await inspectRoute({
          browser,
          targetUrl,
          route,
          viewport,
          navigationTimeoutMs,
          artifactDirectory,
        });
        routeResults.push(result);
        console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${viewport.name} ${route.path}${result.error ? `: ${result.error}` : ''}`);
      }
    }
  } finally {
    await browser.close();
  }

  const failures = routeResults.filter((result) => result.status === 'failed');
  const staleWarnings = routeResults
    .filter((result) => result.status === 'passed' && result.staleDataVisible)
    .map((result) => `${result.viewport} ${result.route}: stale snapshot warning visible`);
  const report = {
    connected: failures.length === 0,
    checkedAt: new Date().toISOString(),
    productionUrl: targetUrl.toString(),
    routesChecked: routeResults.length,
    routesPassed: routeResults.length - failures.length,
    routesFailed: failures.length,
    viewports: PRODUCTION_VIEWPORTS.map((viewport) => viewport.name),
    warnings: uniqueMessages(staleWarnings),
    errors: failures.map(({ viewport, route, error }) => ({ viewport, route, message: error })),
    routeResults,
  };

  await writeFile(`${artifactDirectory}/route-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.connected) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
