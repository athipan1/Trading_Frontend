import path from 'node:path';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const SNAPSHOT_PATTERN = 'https://snapshot.test/dashboard.json?*';
const AXE_PATH = path.resolve(process.cwd(), '.cache', 'axe-core', 'axe.min.js');
const STAGES = ['scanner', 'backtest', 'market_regime', 'portfolio', 'profit', 'risk', 'execution'];

function fixture() {
  return JSON.parse(readFileSync(new URL('../tests/fixtures/dashboard/success.json', import.meta.url), 'utf8'));
}

function stages(status = 'not_attempted') {
  return STAGES.map((id) => ({ id, status: id === 'scanner' ? 'success' : status, reasonCodes: [], observedAt: '2026-08-10T05:00:00Z', summary: {} }));
}

function historyCycle({ source, reasonCode, cycleId, candidates = [] }) {
  return {
    source,
    flowKind: 'decision_path',
    correlationId: source === 'hourly_artifact' ? cycleId : null,
    cycleId: source === 'hourly_artifact' ? cycleId : null,
    workflowRunId: 31360000000 + cycleId.length,
    observedAt: '2026-08-10T05:00:00Z',
    status: reasonCode ? 'controlled_no_trade' : 'completed',
    reasonCode,
    summary: {
      candidateCount: candidates.length,
      buyCount: candidates.filter((candidate) => candidate.verdict === 'buy').length,
      blockedCount: candidates.filter((candidate) => candidate.status === 'blocked').length,
      executedCount: candidates.filter((candidate) => candidate.status === 'executed').length,
      riskRejectedCount: 0,
      executionFailureCount: 0,
    },
    stages: stages(reasonCode ? 'not_attempted' : 'success'),
    candidates: candidates.map((candidate) => ({ ...candidate, refs: { decisionId: null, positionId: null } })),
  };
}

function decisionCycle() {
  return historyCycle({
    source: 'hourly_artifact',
    reasonCode: 'no_preselected_backtest_symbols',
    cycleId: 'decision-cycle',
    candidates: [{
      symbol: 'BANX', rank: 1, verdict: 'buy', finalScore: 0.638,
      strategyBucket: 'value_rebound', status: 'blocked', stageReached: 'scanner',
      reasonCodes: ['investability_market_cap_below_minimum'],
    }],
  });
}

function observability(decision) {
  return {
    schemaVersion: 'trading-observability.v1',
    current: { ...decision, candidates: decision.candidates },
    lastMeaningful: null,
  };
}

function analytics() {
  const funnel = STAGES.map((stage, index) => ({ stage, reachedCount: index === 0 ? 1 : 0, reachRate: index === 0 ? 1 : 0 }));
  const window = (size) => ({
    size,
    cyclesAvailable: 1,
    metrics: { candidateCount: 1, buyCount: 1, blockedCount: 1, executedCount: 0, riskRejectedCount: 0, executionFailureCount: 0 },
    rates: { buyRate: 1, blockedRate: 1, executionRate: 0, riskRejectionRate: null, executionFailureRate: null },
    funnel,
    topBlockingReasons: [{ code: 'investability_market_cap_below_minimum', count: 1, shareOfBlockedCandidates: 1 }],
  });
  return {
    schemaVersion: 'decision-analytics.v1',
    generatedAt: '2026-08-10T05:00:00Z',
    sourceHistorySchemaVersion: 'decision-history.v1',
    overallStatus: 'warning',
    latest: null,
    latestMeaningful: null,
    windows: [window(6), window(12), window(24)],
    trend: { comparison: 'latest6_vs_previous6', enoughData: false, latestCycles: 1, previousCycles: 0, candidateCountDelta: null, blockedRateDeltaPoints: null, executionRateDeltaPoints: null, riskRejectionRateDeltaPoints: null },
    alerts: [{ code: 'insufficient_meaningful_history', severity: 'info', status: 'active', value: 1, threshold: 6, windowCycles: 1, observedAt: '2026-08-10T05:00:00Z' }],
    dataQuality: { historyCycles: 3, meaningfulCycles: 1, metadataOnlyCycles: 1, latestCycleSource: 'hourly_artifact', latestReasonCode: 'no_preselected_backtest_symbols', latestMeaningfulObservedAt: '2026-08-10T05:00:00Z', sufficientFor6CycleWindow: false, sufficientForTrendComparison: false },
  };
}

async function mockSnapshot(page) {
  await page.addInitScript(() => window.localStorage.setItem('trading-dashboard-language', 'en'));
  const decision = decisionCycle();
  const payload = fixture();
  payload.observability = observability(decision);
  payload.decisionHistory = {
    schemaVersion: 'decision-history.v1',
    generatedAt: '2026-08-10T05:00:00Z',
    retentionCycles: 24,
    cycles: [
      decision,
      historyCycle({ source: 'workflow_metadata', reasonCode: 'scheduled_paper_cycle_not_authorized', cycleId: 'control-cycle' }),
      historyCycle({ source: 'workflow_metadata', reasonCode: 'hourly_artifact_unavailable', cycleId: 'gap-cycle' }),
    ],
  };
  payload.decisionAnalytics = analytics();
  await page.route(SNAPSHOT_PATTERN, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
}

async function noOverflow(page) {
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

test('Phase 19 separates decision, control, and true artifact-gap cycles', async ({ page }) => {
  await mockSnapshot(page);
  await page.goto('/system');

  await expect(page.getByTestId('pipeline-reliability')).toBeVisible();
  await expect(page.getByTestId('pipeline-decision-cycles')).toHaveText('1');
  await expect(page.getByTestId('pipeline-control-cycles')).toHaveText('1');
  await expect(page.getByTestId('pipeline-metadata-gaps')).toHaveText('1');
  await expect(page.getByTestId('pipeline-artifact-coverage')).toHaveText('33.3%');
  await expect(page.getByTestId('pipeline-latest-class')).toHaveText('Decision');
  await expect(page.getByTestId('pipeline-reliability-status')).toContainText('True artifact gaps remain');
});

test('Phase 19 remains usable at 320px without page-level overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSnapshot(page);
  await page.goto('/system');
  await expect(page.getByTestId('pipeline-reliability')).toBeVisible();
  await noOverflow(page);
});

test('@a11y Phase 19 reliability state has no serious or critical axe violations', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockSnapshot(page);
  await page.goto('/system');
  await expect(page.getByTestId('pipeline-reliability')).toBeVisible();
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'] },
    resultTypes: ['violations'],
  }));
  await testInfo.attach('phase19-axe.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
  expect(serious).toEqual([]);
});
