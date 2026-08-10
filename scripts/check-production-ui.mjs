import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const DEFAULT_URL = 'https://trading-frontend-wheat-pi.vercel.app/';
const MANAGER_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';
const DEFAULT_ATTEMPTS = 24;
const DEFAULT_DELAY_MS = 15_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const ALLOWED_RUNTIME_MODES = new Set(['PAPER', 'SIMULATOR']);
const DECISION_HISTORY_SCHEMA_VERSION = 'decision-history.v1';
const DECISION_ANALYTICS_SCHEMA_VERSION = 'decision-analytics.v1';
const DECISION_HISTORY_RETENTION = 24;
const STAGE_IDS = ['scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution'];
const ANALYTICS_WINDOW_SIZES = [6, 12, 24];
const ANALYTICS_STATUSES = new Set(['healthy', 'warning', 'critical']);
const ALERT_SEVERITIES = new Set(['info', 'warning', 'critical']);

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function approvedProductionUrl(value) {
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

function sanitizeMessage(error) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export function evaluateUiStatus({ errorBannerTexts = [], staleBannerCount = 0 }) {
  const applicationErrors = errorBannerTexts
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (applicationErrors.length > 0) {
    throw new Error(`Production UI reports a data-load error: ${applicationErrors.join(' | ')}`);
  }
  const staleDataVisible = Number(staleBannerCount) > 0;
  return {
    staleDataVisible,
    warnings: staleDataVisible
      ? ['Production UI is healthy but displays a stale Manager snapshot warning.']
      : [],
  };
}

export function evaluateTelemetryContract(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Manager_Agent snapshot telemetry payload is not a JSON object');
  }
  if (!Array.isArray(payload.agents)) {
    throw new Error('Manager_Agent snapshot is missing the agents projection');
  }
  if (!Object.hasOwn(payload, 'risk')) {
    throw new Error('Manager_Agent snapshot is missing the risk projection');
  }
  if (!payload.backtest || typeof payload.backtest !== 'object' || Array.isArray(payload.backtest)) {
    throw new Error('Manager_Agent snapshot is missing the backtest projection');
  }
  if (!Object.hasOwn(payload.backtest, 'latestRun') || !Array.isArray(payload.backtest.history)) {
    throw new Error('Manager_Agent backtest projection is malformed');
  }

  const decisionHistory = payload.decisionHistory;
  if (!decisionHistory || typeof decisionHistory !== 'object' || Array.isArray(decisionHistory)) {
    throw new Error('Manager_Agent snapshot is missing the decisionHistory projection');
  }
  if (decisionHistory.schemaVersion !== DECISION_HISTORY_SCHEMA_VERSION) {
    throw new Error(`Manager_Agent decisionHistory schema must be ${DECISION_HISTORY_SCHEMA_VERSION}`);
  }
  if (decisionHistory.retentionCycles !== DECISION_HISTORY_RETENTION) {
    throw new Error(`Manager_Agent decisionHistory retention must be ${DECISION_HISTORY_RETENTION} cycles`);
  }
  if (!Array.isArray(decisionHistory.cycles)
    || decisionHistory.cycles.length < 1
    || decisionHistory.cycles.length > DECISION_HISTORY_RETENTION) {
    throw new Error('Manager_Agent decisionHistory must contain 1-24 cycles');
  }
  for (const [index, cycle] of decisionHistory.cycles.entries()) {
    if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
      throw new Error(`Manager_Agent decisionHistory cycle ${index} is malformed`);
    }
    if (!Array.isArray(cycle.stages) || cycle.stages.length !== STAGE_IDS.length) {
      throw new Error(`Manager_Agent decisionHistory cycle ${index} must contain exactly 7 stages`);
    }
    if (!Array.isArray(cycle.candidates) || cycle.candidates.length > 10) {
      throw new Error(`Manager_Agent decisionHistory cycle ${index} has an invalid candidate count`);
    }
  }

  const analytics = payload.decisionAnalytics;
  if (!analytics || typeof analytics !== 'object' || Array.isArray(analytics)) {
    throw new Error('Manager_Agent snapshot is missing the decisionAnalytics projection');
  }
  if (analytics.schemaVersion !== DECISION_ANALYTICS_SCHEMA_VERSION) {
    throw new Error(`Manager_Agent decisionAnalytics schema must be ${DECISION_ANALYTICS_SCHEMA_VERSION}`);
  }
  if (analytics.sourceHistorySchemaVersion !== DECISION_HISTORY_SCHEMA_VERSION) {
    throw new Error('Manager_Agent decisionAnalytics source history schema is invalid');
  }
  if (!ANALYTICS_STATUSES.has(analytics.overallStatus)) {
    throw new Error('Manager_Agent decisionAnalytics overallStatus is invalid');
  }
  if (!Array.isArray(analytics.windows) || analytics.windows.length !== ANALYTICS_WINDOW_SIZES.length) {
    throw new Error('Manager_Agent decisionAnalytics must contain 6/12/24 windows');
  }
  for (const [index, window] of analytics.windows.entries()) {
    if (!window || typeof window !== 'object' || Array.isArray(window)
      || window.size !== ANALYTICS_WINDOW_SIZES[index]) {
      throw new Error(`Manager_Agent decisionAnalytics window ${index} is malformed`);
    }
    if (!Array.isArray(window.funnel)
      || window.funnel.map((row) => row?.stage).join(',') !== STAGE_IDS.join(',')) {
      throw new Error(`Manager_Agent decisionAnalytics window ${window.size} funnel is malformed`);
    }
    if (!Array.isArray(window.topBlockingReasons) || window.topBlockingReasons.length > 8) {
      throw new Error(`Manager_Agent decisionAnalytics window ${window.size} blocking reasons are malformed`);
    }
  }
  if (!Array.isArray(analytics.alerts) || analytics.alerts.length > 8
    || analytics.alerts.some((alert) => !ALERT_SEVERITIES.has(alert?.severity))) {
    throw new Error('Manager_Agent decisionAnalytics alerts are malformed');
  }
  if (!analytics.dataQuality || typeof analytics.dataQuality !== 'object'
    || analytics.dataQuality.historyCycles !== decisionHistory.cycles.length
    || analytics.dataQuality.meaningfulCycles < 0
    || analytics.dataQuality.meaningfulCycles > decisionHistory.cycles.length) {
    throw new Error('Manager_Agent decisionAnalytics data quality is malformed');
  }

  return {
    agentTelemetryCount: payload.agents.length,
    riskTelemetryAvailable: payload.risk !== null,
    backtestTelemetryAvailable: payload.backtest.latestRun !== null || payload.backtest.history.length > 0,
    decisionHistoryCycleCount: decisionHistory.cycles.length,
    decisionAnalyticsStatus: analytics.overallStatus,
    decisionAnalyticsAlertCount: analytics.alerts.length,
    decisionAnalyticsMeaningfulCycles: analytics.dataQuality.meaningfulCycles,
  };
}

export async function inspectPage(page, targetUrl, navigationTimeoutMs) {
  let managerResponse = null;
  const responseListener = (response) => {
    if (response.url().split('?')[0] === MANAGER_SNAPSHOT_URL) {
      managerResponse = response;
    }
  };
  page.on('response', responseListener);

  try {
    const pageResponse = await page.goto(`${targetUrl.toString()}?smoke=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });
    if (!pageResponse) {
      throw new Error('Production page did not return an HTTP response');
    }
    if (pageResponse.status() >= 400) {
      throw new Error(`Production page returned HTTP ${pageResponse.status()}`);
    }

    const dataSource = page.getByTestId('data-source');
    const schemaVersion = page.getByTestId('schema-version');
    const tradingMode = page.getByTestId('trading-mode');
    await dataSource.waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await schemaVersion.waitFor({ state: 'visible', timeout: navigationTimeoutMs });
    await tradingMode.waitFor({ state: 'visible', timeout: navigationTimeoutMs });

    const dataSourceText = (await dataSource.textContent())?.trim() ?? '';
    const schemaText = (await schemaVersion.textContent())?.trim() ?? '';
    const runtimeModeText = (await tradingMode.textContent())?.trim().toUpperCase() ?? '';
    const errorBannerTexts = await page
      .locator('.error-banner[role="alert"]')
      .allTextContents();
    const staleBannerCount = await page
      .locator('.stale-banner[role="alert"]')
      .count();
    const operatorInputCount = await page
      .locator('input[placeholder="ใส่ WEB_CONTROL_OPERATOR_TOKEN"]')
      .count();
    const readOnlyBannerCount = await page
      .locator('[aria-label="Read-only public snapshot mode"]')
      .count();
    const uiStatus = evaluateUiStatus({ errorBannerTexts, staleBannerCount });

    if (!dataSourceText.includes('public-snapshot')) {
      throw new Error(
        `Production data source is not public-snapshot: ${dataSourceText || '(empty)'}`,
      );
    }
    if (!schemaText.includes('dashboard-snapshot.v2')) {
      throw new Error(
        `Production schema is not dashboard-snapshot.v2: ${schemaText || '(empty)'}`,
      );
    }
    if (!ALLOWED_RUNTIME_MODES.has(runtimeModeText)) {
      throw new Error(
        `Production runtime mode must be PAPER or SIMULATOR: ${runtimeModeText || '(empty)'}`,
      );
    }
    if (operatorInputCount !== 0) {
      throw new Error(
        'Operator token control must not be exposed in public snapshot mode',
      );
    }
    if (readOnlyBannerCount !== 1) {
      throw new Error('Read-only public snapshot banner is missing');
    }
    if (!managerResponse) {
      throw new Error('Browser did not request the Manager_Agent public snapshot');
    }
    if (managerResponse.status() !== 200) {
      throw new Error(`Manager_Agent snapshot returned HTTP ${managerResponse.status()}`);
    }

    let managerPayload;
    try {
      managerPayload = await managerResponse.json();
    } catch {
      throw new Error('Manager_Agent snapshot response is not valid JSON');
    }
    const telemetry = evaluateTelemetryContract(managerPayload);

    return {
      connected: true,
      pageStatus: pageResponse.status(),
      dataSourceText,
      schemaText,
      runtimeModeText,
      managerSnapshotStatus: managerResponse.status(),
      managerSnapshotUrl: MANAGER_SNAPSHOT_URL,
      operatorControlExposed: false,
      readOnlyBannerVisible: true,
      ...telemetry,
      ...uiStatus,
    };
  } finally {
    page.off('response', responseListener);
  }
}

async function main() {
  const targetUrl = approvedProductionUrl(process.env.PRODUCTION_URL);
  const attempts = positiveInteger(
    process.env.PRODUCTION_SMOKE_ATTEMPTS,
    DEFAULT_ATTEMPTS,
    'PRODUCTION_SMOKE_ATTEMPTS',
  );
  const delayMs = positiveInteger(
    process.env.PRODUCTION_SMOKE_DELAY_MS,
    DEFAULT_DELAY_MS,
    'PRODUCTION_SMOKE_DELAY_MS',
  );
  const navigationTimeoutMs = positiveInteger(
    process.env.PRODUCTION_SMOKE_NAVIGATION_TIMEOUT_MS,
    DEFAULT_NAVIGATION_TIMEOUT_MS,
    'PRODUCTION_SMOKE_NAVIGATION_TIMEOUT_MS',
  );
  const artifactDirectory =
    process.env.PRODUCTION_SMOKE_ARTIFACT_DIR || 'production-smoke-artifacts';
  await mkdir(artifactDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
  });
  const page = await context.newPage();
  const failures = [];
  let result = null;

  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const inspection = await inspectPage(page, targetUrl, navigationTimeoutMs);
        result = {
          ...inspection,
          checkedAt: new Date().toISOString(),
          productionUrl: targetUrl.toString(),
          attemptsUsed: attempt,
          errors: [],
        };
        break;
      } catch (error) {
        const message = sanitizeMessage(error);
        failures.push({ attempt, message, at: new Date().toISOString() });
        console.error(
          `Production smoke attempt ${attempt}/${attempts} failed: ${message}`,
        );
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (!result) {
      await page
        .screenshot({ path: `${artifactDirectory}/failure.png`, fullPage: true })
        .catch(() => {});
      result = {
        connected: false,
        checkedAt: new Date().toISOString(),
        productionUrl: targetUrl.toString(),
        attemptsUsed: attempts,
        warnings: [],
        errors: failures,
      };
    } else {
      await page.screenshot({
        path: `${artifactDirectory}/success.png`,
        fullPage: true,
      });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    `${artifactDirectory}/report.json`,
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.connected) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
