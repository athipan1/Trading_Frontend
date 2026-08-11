import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const FIXED_NOW = '2026-08-01T07:00:00.000Z';
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];
const LANGUAGES = ['th', 'en'];
const PRIMARY_ROUTES = [
  { route: '/portfolio', fixtureName: 'success', readyTestId: 'page-portfolio' },
  { route: '/orders', fixtureName: 'success', readyTestId: 'page-orders' },
  { route: '/agents', fixtureName: 'agent-telemetry', readyTestId: 'page-agents' },
  { route: '/risk', fixtureName: 'success', readyTestId: 'page-risk' },
  { route: '/backtest', fixtureName: 'success', readyTestId: 'page-backtest' },
];
const REDESIGNED_ROUTES = [
  { route: '/overview', fixtureName: 'success', readyTestId: 'page-overview' },
  { route: '/system', fixtureName: 'execution-failure', readyTestId: 'hourly-automation-status' },
];

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../tests/fixtures/dashboard/${name}.json`, import.meta.url), 'utf8'));
}

function partialFillFixture() {
  const payload = fixture('execution-failure');
  payload.workflow = { ...payload.workflow, conclusion: 'success' };
  payload.cycle = {
    ...payload.cycle,
    status: 'success',
    executionAttempted: true,
    executionStatus: 'partial_fill',
    executionReason: 'partial_fill',
    partialFillDetected: true,
  };
  payload.summary = {
    ...payload.summary,
    executionStatus: 'partial_fill',
    executionReason: 'partial_fill',
  };
  payload.error = null;
  payload.phases = payload.phases.map((phase) => (
    phase.name === 'execution'
      ? { ...phase, status: 'warning', message: 'Paper order was only partially filled.' }
      : phase
  ));
  return payload;
}

function agentTelemetryFixture() {
  const payload = fixture('success');
  payload.agents = [
    { id: 'manager_agent', name: 'Manager Agent', health: 'healthy', status: 'running', latencyMs: 24, version: '2.4.1', cpuPercent: 18, memoryMb: 412, lastRunAt: '2026-07-30T00:00:00Z' },
    { id: 'database_agent', name: 'Database Agent', health: 'healthy', status: 'connected', latencyMs: 11, version: '1.8.0', cpuPercent: 9, memoryPercent: 34, lastRunAt: '2026-07-29T23:59:52Z' },
    { id: 'scanner_agent', name: 'Scanner Agent', health: 'healthy', status: 'completed', latencyMs: 182, version: '3.2.0', cpuPercent: 37, memoryMb: 684, lastRunAt: '2026-07-29T23:56:00Z' },
    { id: 'risk_agent', name: 'Risk Agent', health: 'degraded', status: 'candidate_rejected', latencyMs: 46, version: '2.0.7', cpuPercent: 21, memoryMb: 305, lastRunAt: '2026-07-29T23:58:30Z' },
  ];
  return payload;
}

function visualFixture(name) {
  if (name === 'partial-fill') return partialFillFixture();
  if (name === 'agent-telemetry') return agentTelemetryFixture();
  return fixture(name);
}

async function mockSnapshot(page, payload) {
  await page.route('https://snapshot.test/dashboard.json?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

async function installDeterministicBrowserState(page, language) {
  await page.addInitScript(({ fixedNow, selectedLanguage }) => {
    window.localStorage.setItem('trading-dashboard-language', selectedLanguage);
    const NativeDate = Date;
    const fixedTimestamp = NativeDate.parse(fixedNow);
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length === 0 ? [fixedTimestamp] : args)); }
      static now() { return fixedTimestamp; }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
  }, { fixedNow: FIXED_NOW, selectedLanguage: language });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
}

async function openVisualCase(page, visualCase) {
  const { route, fixtureName, readyTestId, viewport, language } = visualCase;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await installDeterministicBrowserState(page, language);
  await mockSnapshot(page, visualFixture(fixtureName));
  const snapshotResponse = page.waitForResponse((response) => response.url().startsWith('https://snapshot.test/dashboard.json'));
  await page.goto(route);
  await snapshotResponse;
  await expect(page.getByTestId(readyTestId)).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts?.ready;
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;caret-color:transparent!important;transition:none!important}' });
  const dimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(dimensions.documentWidth, `${route} must not overflow horizontally at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
}

function screenshotName({ route, fixtureName, viewport, language }) {
  const routeName = route.replace(/^\//, '') || 'overview';
  return `${routeName}-${fixtureName}-${language}-${viewport.name}.png`;
}

async function attachPhase21Evidence(page, testInfo, visualCase) {
  const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', scale: 'css' });
  await testInfo.attach(`phase21-${screenshotName(visualCase)}`, { body: screenshot, contentType: 'image/png' });
}

async function expectPhase21VisualContract(page, route, { expectPhases = true } = {}) {
  if (route === '/overview') {
    await expect(page.locator('.overview-system-card')).toBeVisible();
    await expect(page.locator('.overview-system-card')).toHaveCSS('background-image', /linear-gradient/);
    await expect(page.locator('.metrics-grid .metric-card')).toHaveCount(4);
    await expect(page.locator('.dashboard-insights')).toBeVisible();
    return;
  }
  await expect(page.locator('.automation-panel')).toBeVisible();
  await expect(page.locator('.automation-panel')).toHaveCSS('background-image', /linear-gradient/);
  await expect(page.locator('.incident-summary')).toBeVisible();
  if (expectPhases) await expect(page.locator('.phase-timeline')).toBeVisible();
}

test.describe('@visual unchanged primary route baselines', () => {
  for (const primaryRoute of PRIMARY_ROUTES) for (const viewport of VIEWPORTS) for (const language of LANGUAGES) {
    const visualCase = { ...primaryRoute, viewport, language };
    test(`${primaryRoute.route} ${language} ${viewport.name}`, async ({ page }) => {
      await openVisualCase(page, visualCase);
      await expect(page).toHaveScreenshot(screenshotName(visualCase), { animations: 'disabled', caret: 'hide', fullPage: true, scale: 'css' });
    });
  }
});

test.describe('@visual Phase 21 redesigned route evidence', () => {
  for (const redesignedRoute of REDESIGNED_ROUTES) for (const viewport of VIEWPORTS) for (const language of LANGUAGES) {
    const visualCase = { ...redesignedRoute, viewport, language };
    test(`${redesignedRoute.route} ${language} ${viewport.name}`, async ({ page }, testInfo) => {
      await openVisualCase(page, visualCase);
      await expectPhase21VisualContract(page, redesignedRoute.route);
      await attachPhase21Evidence(page, testInfo, visualCase);
    });
  }
});

const INCIDENT_CASES = [
  { fixtureName: 'stale', label: 'stale snapshot' },
  { fixtureName: 'workflow-failure', label: 'workflow failure' },
  { fixtureName: 'partial-fill', label: 'partial fill' },
];
const INCIDENT_VIEWPORTS = [VIEWPORTS[0], VIEWPORTS[2]];

test.describe('@visual Phase 21 system incident evidence', () => {
  for (const incidentCase of INCIDENT_CASES) for (const viewport of INCIDENT_VIEWPORTS) {
    const visualCase = { route: '/system', fixtureName: incidentCase.fixtureName, readyTestId: 'hourly-automation-status', viewport, language: 'th' };
    test(`${incidentCase.label} ${viewport.name}`, async ({ page }, testInfo) => {
      await openVisualCase(page, visualCase);
      await expect(page.getByTestId('system-incident-summary')).toBeVisible();
      await expectPhase21VisualContract(page, '/system', { expectPhases: incidentCase.fixtureName === 'partial-fill' });
      await attachPhase21Evidence(page, testInfo, visualCase);
    });
  }
});
