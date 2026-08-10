import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SNAPSHOT_PATTERN = 'https://snapshot.test/dashboard.json?*';
const AXE_PATH = path.resolve(process.cwd(), '.cache', 'axe-core', 'axe.min.js');
const STAGE_IDS = ['scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution'];

function fixture() {
  return JSON.parse(readFileSync(new URL('../tests/fixtures/dashboard/success.json', import.meta.url), 'utf8'));
}

function stage(id, status, reasonCodes = []) {
  return { id, status, reasonCodes, observedAt: '2026-08-09T11:48:23Z', summary: {} };
}

function meaningfulCycle() {
  return {
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
}

function observabilityPayload() {
  const meaningful = meaningfulCycle();
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

function withHistoryFields(cycle, overrides = {}) {
  const candidates = (overrides.candidates || cycle.candidates).map((candidate) => ({
    ...candidate,
    refs: candidate.refs || { decisionId: null, positionId: null },
  }));
  return {
    ...cycle,
    ...overrides,
    candidates,
    summary: overrides.summary || {
      candidateCount: candidates.length,
      buyCount: candidates.filter((candidate) => candidate.verdict === 'buy').length,
      blockedCount: candidates.filter((candidate) => candidate.status === 'blocked').length,
      executedCount: candidates.filter((candidate) => candidate.status === 'executed').length,
      riskRejectedCount: candidates.filter((candidate) => candidate.status === 'blocked' && candidate.stageReached === 'risk').length,
      executionFailureCount: candidates.filter((candidate) => candidate.status === 'blocked' && candidate.stageReached === 'execution').length,
    },
  };
}

function decisionHistoryPayload() {
  const first = withHistoryFields(meaningfulCycle(), {
    candidates: meaningfulCycle().candidates.map((candidate) => candidate.symbol === 'BANX'
      ? { ...candidate, refs: { decisionId: 'decision-banx-1', positionId: 'position-banx-1' } }
      : candidate),
  });
  const secondBase = meaningfulCycle();
  const second = withHistoryFields(secondBase, {
    correlationId: 'hourly-paper-test-20260809T10',
    cycleId: 'hourly-paper-test-20260809T10',
    workflowRunId: 31310000000,
    observedAt: '2026-08-09T10:48:23Z',
    reasonCode: 'risk_rejected',
    stages: STAGE_IDS.map((id) => stage(id, id === 'risk' ? 'blocked' : (['scanner', 'backtest', 'market_regime', 'portfolio'].includes(id) ? 'success' : 'not_attempted'))),
    candidates: [{
      symbol: 'AAPL', rank: 1, verdict: 'buy', finalScore: 0.81,
      strategyBucket: 'core_dividend', status: 'blocked', stageReached: 'risk',
      reasonCodes: ['risk_rejected'], refs: { decisionId: 'decision-aapl-1', positionId: 'position-aapl-1' },
    }],
  });
  return {
    schemaVersion: 'decision-history.v1',
    generatedAt: '2026-08-09T14:50:00Z',
    retentionCycles: 24,
    cycles: [first, second],
  };
}

function analyticsWindow(size, candidateCount) {
  return {
    size,
    cyclesAvailable: 2,
    metrics: {
      candidateCount,
      buyCount: 2,
      blockedCount: 2,
      executedCount: 0,
      riskRejectedCount: 1,
      executionFailureCount: 0,
    },
    rates: {
      buyRate: 2 / candidateCount,
      blockedRate: 2 / candidateCount,
      executionRate: 0,
      riskRejectionRate: 1,
      executionFailureRate: null,
    },
    funnel: STAGE_IDS.map((stageId, index) => ({
      stage: stageId,
      reachedCount: index === 0 ? candidateCount : index <= 5 ? 1 : 0,
      reachRate: index === 0 ? 1 : index <= 5 ? 1 / candidateCount : 0,
    })),
    topBlockingReasons: [
      { code: 'investability_market_cap_below_minimum', count: 1, shareOfBlockedCandidates: 0.5 },
      { code: 'risk_rejected', count: 1, shareOfBlockedCandidates: 0.5 },
    ],
  };
}

function decisionAnalyticsPayload() {
  return {
    schemaVersion: 'decision-analytics.v1',
    generatedAt: '2026-08-09T14:50:00Z',
    sourceHistorySchemaVersion: 'decision-history.v1',
    overallStatus: 'warning',
    latest: {
      source: 'hourly_artifact', correlationId: 'hourly-paper-test-20260809T11',
      cycleId: 'hourly-paper-test-20260809T11', workflowRunId: 31311487235,
      observedAt: '2026-08-09T11:48:23Z', status: 'controlled_no_trade',
      reasonCode: 'no_preselected_backtest_symbols',
      summary: { candidateCount: 2, buyCount: 1, blockedCount: 1, executedCount: 0, riskRejectedCount: 0, executionFailureCount: 0 },
    },
    latestMeaningful: {
      source: 'hourly_artifact', correlationId: 'hourly-paper-test-20260809T11',
      cycleId: 'hourly-paper-test-20260809T11', workflowRunId: 31311487235,
      observedAt: '2026-08-09T11:48:23Z', status: 'controlled_no_trade',
      reasonCode: 'no_preselected_backtest_symbols',
      summary: { candidateCount: 2, buyCount: 1, blockedCount: 1, executedCount: 0, riskRejectedCount: 0, executionFailureCount: 0 },
    },
    windows: [analyticsWindow(6, 3), analyticsWindow(12, 4), analyticsWindow(24, 4)],
    trend: {
      comparison: 'latest6_vs_previous6', enoughData: false,
      latestCycles: 2, previousCycles: 0, candidateCountDelta: null,
      blockedRateDeltaPoints: null, executionRateDeltaPoints: null, riskRejectionRateDeltaPoints: null,
    },
    alerts: [
      {
        code: 'snapshot_stale', severity: 'warning', status: 'active', value: 545.68,
        threshold: 120, windowCycles: null, observedAt: '2026-08-09T14:50:00Z',
      },
      {
        code: 'insufficient_meaningful_history', severity: 'info', status: 'active', value: 2,
        threshold: 6, windowCycles: 2, observedAt: '2026-08-09T14:50:00Z',
      },
    ],
    dataQuality: {
      historyCycles: 2, meaningfulCycles: 2, metadataOnlyCycles: 0,
      latestCycleSource: 'hourly_artifact', latestReasonCode: 'no_preselected_backtest_symbols',
      latestMeaningfulObservedAt: '2026-08-09T11:48:23Z',
      sufficientFor6CycleWindow: false, sufficientForTrendComparison: false,
    },
  };
}

async function mockSnapshot(page, { includeHistory = true, includeAnalytics = true } = {}) {
  await page.addInitScript(() => {
    window.localStorage.setItem('trading-dashboard-language', 'en');
  });
  const payload = fixture();
  payload.observability = observabilityPayload();
  if (includeHistory) payload.decisionHistory = decisionHistoryPayload();
  if (includeAnalytics) payload.decisionAnalytics = decisionAnalyticsPayload();
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

  for (const id of STAGE_IDS) {
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

test('Phase 17 exposes bounded cycle history and symbol drill-down', async ({ page }) => {
  await mockSnapshot(page);
  await page.goto('/system');

  const history = page.getByTestId('decision-history-panel');
  await expect(history).toBeVisible();
  await expect(page.getByTestId('decision-history-count')).toContainText('2/24');
  await expect(page.getByTestId('decision-history-cycle-list').locator('button')).toHaveCount(2);
  await expect(page.getByTestId('decision-history-drilldown')).toContainText('hourly-paper-test-20260809T11');

  await page.getByTestId('decision-history-symbol-BANX').click();
  const detail = page.getByTestId('decision-history-candidate-detail');
  await expect(detail).toContainText('BANX');
  await expect(detail).toContainText('decision-banx-1');
  await expect(detail).toContainText('position-banx-1');
  await expect(detail).toContainText('Market cap below minimum');
});

test('Phase 17 filters history by symbol, result, and stage reached', async ({ page }) => {
  await mockSnapshot(page);
  await page.goto('/system');

  await page.getByTestId('decision-history-symbol-filter').selectOption('AAPL');
  await expect(page.getByTestId('decision-history-cycle-list').locator('button')).toHaveCount(1);
  await expect(page.getByTestId('decision-history-drilldown')).toContainText('hourly-paper-test-20260809T10');
  await expect(page.getByTestId('decision-history-candidate-detail')).toContainText('Risk gate rejected');

  await page.getByTestId('decision-history-status-filter').selectOption('blocked');
  await page.getByTestId('decision-history-stage-filter').selectOption('risk');
  await expect(page.getByTestId('decision-history-cycle-list').locator('button')).toHaveCount(1);
  await expect(page.getByTestId('decision-history-candidate-detail')).toContainText('AAPL');
});

test('Phase 18 shows rolling analytics, safety alerts, funnel, top reasons, and pending trend', async ({ page }) => {
  await mockSnapshot(page);
  await page.goto('/system');

  const analytics = page.getByTestId('decision-analytics-panel');
  await expect(analytics).toBeVisible();
  await expect(page.getByTestId('decision-analytics-status')).toHaveText('Warning');
  const staleAlert = page.getByTestId('decision-analytics-alert-snapshot_stale');
  await expect(staleAlert).toContainText('Snapshot is stale');
  await expect(staleAlert).toContainText('threshold 120');
  await expect(page.getByTestId('decision-analytics-alert-insufficient_meaningful_history')).toContainText('INFO');
  await expect(page.getByTestId('decision-analytics-funnel').locator('li')).toHaveCount(7);
  await expect(page.getByTestId('decision-analytics-top-reasons')).toContainText('Market cap below minimum');
  await expect(page.getByTestId('decision-analytics-top-reasons')).toContainText('Risk rejected');
  await expect(page.getByTestId('decision-analytics-trend-pending')).toContainText('Twelve meaningful cycles');
});

test('Phase 18 switches rolling windows without another snapshot request', async ({ page }) => {
  await mockSnapshot(page);
  let snapshotRequests = 0;
  page.on('request', (request) => {
    if (request.url().startsWith('https://snapshot.test/dashboard.json')) snapshotRequests += 1;
  });
  await page.goto('/system');
  await expect(page.getByTestId('decision-analytics-summary')).toContainText('3');
  const requestsAfterLoad = snapshotRequests;

  await page.getByTestId('decision-analytics-window-filter').selectOption('12');
  await expect(page.getByTestId('decision-analytics-summary')).toContainText('4');
  expect(snapshotRequests).toBe(requestsAfterLoad);
});

test('Phase 17 snapshots remain backward compatible when Phase 18 analytics is absent', async ({ page }) => {
  await mockSnapshot(page, { includeAnalytics: false });
  await page.goto('/system');
  await expect(page.getByTestId('trading-observability-panel')).toBeVisible();
  await expect(page.getByTestId('decision-history-panel')).toBeVisible();
  await expect(page.getByTestId('decision-analytics-panel')).toHaveCount(0);
});

test('Phase 16-only snapshots remain backward compatible when history and analytics are absent', async ({ page }) => {
  await mockSnapshot(page, { includeHistory: false, includeAnalytics: false });
  await page.goto('/system');
  await expect(page.getByTestId('trading-observability-panel')).toBeVisible();
  await expect(page.getByTestId('decision-history-panel')).toHaveCount(0);
  await expect(page.getByTestId('decision-analytics-panel')).toHaveCount(0);
});

test('remains usable at 320px without page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSnapshot(page);
  await page.goto('/system');
  await expect(page.getByTestId('trading-observability-panel')).toBeVisible();
  await expect(page.getByTestId('decision-analytics-panel')).toBeVisible();
  await expect(page.getByTestId('decision-history-panel')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('@a11y Phase 18 analytics and history state has no serious or critical axe violations', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSnapshot(page);
  await page.goto('/system');
  await expect(page.getByTestId('decision-analytics-panel')).toBeVisible();
  await expect(page.getByTestId('decision-history-panel')).toBeVisible();
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'] },
    resultTypes: ['violations'],
  }));
  await testInfo.attach('phase18-axe.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  const blocking = results.violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  expect(blocking.map(({ id, impact, help }) => ({ id, impact, help }))).toEqual([]);
});
