import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const DEFAULT_URL = 'https://trading-frontend-wheat-pi.vercel.app/';
const MANAGER_SNAPSHOT_URL = 'https://raw.githubusercontent.com/athipan1/Manager_Agent/dashboard-data/docs/dashboard/latest-dashboard-snapshot.json';
const CONTROL_REASONS = new Set(['hourly_schedule_disabled', 'scheduled_paper_cycle_not_authorized']);
const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

function classify(cycle) {
  if (CONTROL_REASONS.has(cycle?.reasonCode)) return 'control';
  if (cycle?.source === 'workflow_metadata') return 'metadata_gap';
  return 'decision';
}

export function deriveReliability(payload) {
  const history = payload?.decisionHistory;
  const analytics = payload?.decisionAnalytics;
  if (!history || history.schemaVersion !== 'decision-history.v1' || !Array.isArray(history.cycles)) {
    throw new Error('Manager decisionHistory.v1 is required for Phase 19');
  }
  if (history.cycles.length < 1 || history.cycles.length > 24) {
    throw new Error('Manager decision history must contain 1-24 cycles');
  }
  if (!analytics || analytics.schemaVersion !== 'decision-analytics.v1' || !analytics.dataQuality) {
    throw new Error('Manager decisionAnalytics.v1 dataQuality is required for Phase 19');
  }

  const result = {
    historyCycles: history.cycles.length,
    decisionCycles: 0,
    controlCycles: 0,
    metadataGaps: 0,
    artifactBackedCycles: 0,
    artifactCoverageRate: null,
    latestCycleClass: classify(history.cycles[0]),
  };
  for (const cycle of history.cycles) {
    const kind = classify(cycle);
    if (kind === 'decision') result.decisionCycles += 1;
    else if (kind === 'control') result.controlCycles += 1;
    else result.metadataGaps += 1;
    if (cycle?.source === 'hourly_artifact') result.artifactBackedCycles += 1;
  }
  result.artifactCoverageRate = result.artifactBackedCycles / result.historyCycles;

  const quality = analytics.dataQuality;
  const integers = [
    ['historyCycles', result.historyCycles],
    ['meaningfulCycles', result.decisionCycles],
    ['controlCycles', result.controlCycles],
    ['metadataOnlyCycles', result.metadataGaps],
    ['artifactBackedCycles', result.artifactBackedCycles],
  ];
  for (const [field, expected] of integers) {
    if (!Number.isInteger(quality[field]) || quality[field] !== expected) {
      throw new Error(`Manager Phase 19 ${field} mismatch: expected ${expected}, received ${quality[field]}`);
    }
  }
  if (!Number.isFinite(quality.artifactCoverageRate)
    || Math.abs(quality.artifactCoverageRate - result.artifactCoverageRate) > 0.000001) {
    throw new Error('Manager Phase 19 artifactCoverageRate is inconsistent with decision history');
  }
  if (quality.latestCycleClass !== result.latestCycleClass) {
    throw new Error(`Manager Phase 19 latestCycleClass mismatch: expected ${result.latestCycleClass}, received ${quality.latestCycleClass}`);
  }
  return result;
}

function expectedLabel(kind) {
  return kind === 'metadata_gap' ? 'Metadata gap' : kind[0].toUpperCase() + kind.slice(1);
}

async function inspectViewport(browser, target, reliability, viewport, artifactDirectory) {
  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
  try {
    await page.addInitScript(() => window.localStorage.setItem('trading-dashboard-language', 'en'));
    const response = await page.goto(new URL(`/system?phase19=${Date.now()}`, target).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) throw new Error(`Production /system returned HTTP ${response?.status() ?? 'none'}`);
    const panel = page.getByTestId('pipeline-reliability');
    await panel.waitFor({ state: 'visible', timeout: 30_000 });

    const values = {
      decisionCycles: Number(await page.getByTestId('pipeline-decision-cycles').textContent()),
      controlCycles: Number(await page.getByTestId('pipeline-control-cycles').textContent()),
      metadataGaps: Number(await page.getByTestId('pipeline-metadata-gaps').textContent()),
      artifactCoverageText: (await page.getByTestId('pipeline-artifact-coverage').textContent())?.trim() || '',
      latestCycleClass: (await page.getByTestId('pipeline-latest-class').textContent())?.trim() || '',
    };
    if (values.decisionCycles !== reliability.decisionCycles
      || values.controlCycles !== reliability.controlCycles
      || values.metadataGaps !== reliability.metadataGaps) {
      throw new Error(`Phase 19 UI counts do not match Manager history: ${JSON.stringify(values)}`);
    }
    const expectedCoverage = `${(reliability.artifactCoverageRate * 100).toFixed(1)}%`;
    if (values.artifactCoverageText !== expectedCoverage) {
      throw new Error(`Phase 19 UI artifact coverage must be ${expectedCoverage}; received ${values.artifactCoverageText}`);
    }
    if (values.latestCycleClass !== expectedLabel(reliability.latestCycleClass)) {
      throw new Error(`Phase 19 UI latest class mismatch: ${values.latestCycleClass}`);
    }

    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    if (dimensions.document > dimensions.viewport || dimensions.body > dimensions.viewport) {
      throw new Error(`Phase 19 UI overflows viewport: ${JSON.stringify(dimensions)}`);
    }
    if (consoleErrors.length || pageErrors.length) {
      throw new Error(`Phase 19 runtime issues: ${[...consoleErrors, ...pageErrors].join(' | ')}`);
    }

    const screenshot = `${artifactDirectory}/phase19-${viewport.name}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });
    return { viewport: viewport.name, status: 'passed', ...values, dimensions, screenshot };
  } finally {
    await context.close();
  }
}

async function main() {
  const target = new URL(process.env.PRODUCTION_URL || DEFAULT_URL);
  if (target.protocol !== 'https:' || target.hostname !== 'trading-frontend-wheat-pi.vercel.app') {
    throw new Error('Phase 19 production check only allows the approved Vercel production host');
  }
  const artifactDirectory = process.env.PRODUCTION_SMOKE_ARTIFACT_DIR || 'production-smoke-artifacts';
  await mkdir(artifactDirectory, { recursive: true });

  const managerResponse = await fetch(MANAGER_SNAPSHOT_URL, { headers: { accept: 'application/json' } });
  if (!managerResponse.ok) throw new Error(`Manager snapshot returned HTTP ${managerResponse.status}`);
  const payload = await managerResponse.json();
  const reliability = deriveReliability(payload);

  const browser = await chromium.launch({ headless: true });
  const viewportResults = [];
  try {
    for (const viewport of VIEWPORTS) {
      viewportResults.push(await inspectViewport(browser, target, reliability, viewport, artifactDirectory));
    }
  } finally {
    await browser.close();
  }

  const report = {
    connected: true,
    checkedAt: new Date().toISOString(),
    productionUrl: target.toString(),
    managerSnapshotUrl: MANAGER_SNAPSHOT_URL,
    reliability,
    viewportResults,
    errors: [],
  };
  await writeFile(`${artifactDirectory}/pipeline-reliability-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async (error) => {
    const artifactDirectory = process.env.PRODUCTION_SMOKE_ARTIFACT_DIR || 'production-smoke-artifacts';
    await mkdir(artifactDirectory, { recursive: true });
    const report = { connected: false, checkedAt: new Date().toISOString(), errors: [{ message: String(error?.message || error).slice(0, 500) }] };
    await writeFile(`${artifactDirectory}/pipeline-reliability-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(error);
    process.exitCode = 1;
  });
}
