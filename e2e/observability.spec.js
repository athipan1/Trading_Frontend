import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SNAPSHOT_PATTERN = 'https://snapshot.test/dashboard.json?*';
const AXE_PATH = path.resolve(process.cwd(), '.cache', 'axe-core', 'axe.min.js');

function fixture() {
  return JSON.parse(readFileSync(new URL('../tests/fixtures/dashboard/success.json', import.meta.url), 'utf8'));
}

function stage(id, status, reasonCodes = []) {
  return { id, status, reasonCodes, observedAt: '2026-08-09T11:48:23Z', summary: {} };
}

function observabilityPayload() {
  const meaningful = {
    source: 'hourly_artifact',
    flowKind: 'decision_path',
    correlationId: 'hourly-paper-test-20260809T11',
    cycleId: 'hourly-paper-test-20260809T11',
    workflowRunId: 31311487235,
    observedAt: '2026-08-09T11:48:23Z',
    status: 'controlled_no_trade',
    reasonCode: 'no_preselected_backtest_symbols',
    stages: [
      stage('scanner', 'success'),
      stage('backtest', 'skipped', ['no_preselected_backtest_symbols']),
      stage('market_regime', 'success'),
      stage('portfolio', 'success'),
      stage('profit', 'skipped'),
      stage('risk', 'not_attempted', ['no_preselected_backtest_symbols']),
      stage('execution', 'not_attempted', ['no_preselected_backtest_symbols']),
    ],
    candidates: [
      {
        symbol: 'BANX', rank: 1, verdict: 'buy', finalScore: 0.638,
        strategyBucket: 'value_rebound', status: 'blocked', stageReached: 'scanner',
        reasonCodes: [
          'investability_market_cap_below_minimum',
          'investability_average_dollar_volume_below_minimum',
          'investability_spread_missing',
        ],
      },
      {
        symbol: 'YB', rank: 2, verdict: 'hold', finalScore: 0.615,
        strategyBucket: 'value_rebound', status: 'not_selected', stageReached: 'scanner',
        reasonCodes: ['manager_verdict_hold'],
      },
    ],
  };
  return {
    schemaVersion: 'trading-observability.v1',
    current: {
      source: 'workflow_metadata', flowKind: 'decision_path', correlationId: null, cycleId: null,
      workflowRunId: 31319333233, observedAt: '2026-08-09T14:46:30Z', status: 'skipped',
      reasonCode: 'scheduled_paper_cycle_not_authorized',
      stages: [
        stage('scanner', 'skipped', ['scheduled_paper_cycle_not_authorized']),
        stage('backtest', 'skipped', ['scheduled_paper_cycle_not_authorized']),
        stage('market_regime', 'not_attempted', ['scheduled_paper_cycle_not_authorized']),
        stage('portfolio', 'not_attempted', ['scheduled_paper_cycle_not_authorized']),
        stage('profit', 'not_attempted', ['scheduled_paper_cycle_not_authorized']),
        stage('risk', 'not_attempted', ['scheduled_paper_cycle_not_authorized']),
        stage('execution', 'not_attempted', ['scheduled_paper_cycle_not_authorized']),
      ],
      candidates: [],
    },
    lastMeaningful: meaningful,
  };
}

async function mockSnapshot(page) {
  const payload = fixture();
  payload.observability = observabilityPayload();
  await page.route(SNAPSHOT_PATTERN, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }));
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('shows the seven-stage last meaningful decision path and candidate rejection reasons', async ({ page }) => {
  await mockSnapshot(page);
  await page.goto('/system');

  await expect(page.getByTestId('hourly-automation-status')).toBeVisible();
  const panel = page.getByTestId('trading-observability-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('observability-last-meaningful-note')).toBeVisible();
  await expect(page.getByTestId('observability-correlation')).toContainText('hourly-paper-test-20260809T11');

  for (const id of ['scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution']) {
    await expect(page.getByTestId(`observability-stage-${id}`)).toBeVisible();
  }

  const banx = page.getByTestId('observability-candidate-BANX');
  await expect(banx).toContainText('BANX');
  await expect(banx).toContainText('BUY');
  await expect(banx).toContainText('0.638');
  await expect(banx).toContainText('Market cap');
  await expect(banx).toContainText('Average dollar volume');
  await expect(banx).toContainText('Spread evidence');
  await expect(page.getByTestId('observability-candidate-YB')).toContainText('HOLD');
});

test('remains usable at 320px without page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSnapshot(page);
  await page.goto('/system');
  await expect(page.getByTestId('trading-observability-panel')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('@a11y Phase 16 observability state has no serious or critical axe violations', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSnapshot(page);
  await page.goto('/system');
  await expect(page.getByTestId('trading-observability-panel')).toBeVisible();
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'] },
    resultTypes: ['violations'],
  }));
  await testInfo.attach('phase16-axe.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  const blocking = results.violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  expect(blocking.map(({ id, impact, help }) => ({ id, impact, help }))).toEqual([]);
});
