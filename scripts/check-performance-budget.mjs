import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const DEFAULT_DIST_DIR = path.join(ROOT, 'dist');
const DEFAULT_BUDGET_PATH = path.join(ROOT, 'performance-budget.json');
const DEFAULT_REPORT_PATH = path.join(ROOT, 'performance-artifacts', 'bundle-report.json');

function walkFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    return statSync(absolute).isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function relativeAssetPath(distDir, absolutePath) {
  return path.relative(distDir, absolutePath).split(path.sep).join('/');
}

function measureFile(distDir, absolutePath) {
  const body = readFileSync(absolutePath);
  return {
    path: relativeAssetPath(distDir, absolutePath),
    rawBytes: body.length,
    gzipBytes: gzipSync(body, { level: 9 }).length,
  };
}

function sum(files, key) {
  return files.reduce((total, file) => total + file[key], 0);
}

function findEntryScript(distDir, files) {
  const indexPath = path.join(distDir, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  const match = html.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
  if (!match) throw new Error('Performance budget check could not find the module entry script in dist/index.html.');
  const normalized = match[1].replace(/^\//, '');
  const entry = files.find((file) => file.path === normalized);
  if (!entry) throw new Error(`Performance budget check could not find entry asset ${normalized}.`);
  return entry;
}

export function evaluateBundleBudget(metrics, budget) {
  const checks = Object.entries(budget).map(([metric, limit]) => {
    const actual = metrics[metric];
    if (!Number.isFinite(actual)) {
      return { metric, actual, limit, pass: false, reason: 'metric missing or non-finite' };
    }
    return { metric, actual, limit, pass: actual <= limit };
  });
  return {
    pass: checks.every((check) => check.pass),
    checks,
    failures: checks.filter((check) => !check.pass),
  };
}

export function analyzeBundle({ distDir = DEFAULT_DIST_DIR, budgetPath = DEFAULT_BUDGET_PATH } = {}) {
  if (!existsSync(distDir)) throw new Error(`Performance budget check requires a production build at ${distDir}.`);
  const budgetDocument = JSON.parse(readFileSync(budgetPath, 'utf8'));
  const measuredFiles = walkFiles(distDir).map((file) => measureFile(distDir, file));
  const jsFiles = measuredFiles.filter((file) => file.path.endsWith('.js'));
  const cssFiles = measuredFiles.filter((file) => file.path.endsWith('.css'));
  const entry = findEntryScript(distDir, measuredFiles);
  const metrics = {
    entryJsRawBytes: entry.rawBytes,
    entryJsGzipBytes: entry.gzipBytes,
    totalJsGzipBytes: sum(jsFiles, 'gzipBytes'),
    totalCssRawBytes: sum(cssFiles, 'rawBytes'),
    totalCssGzipBytes: sum(cssFiles, 'gzipBytes'),
    totalDistGzipBytes: sum(measuredFiles, 'gzipBytes'),
    assetCount: measuredFiles.length,
    jsAssetCount: jsFiles.length,
  };
  const evaluation = evaluateBundleBudget(metrics, budgetDocument.bundle);
  return {
    generatedAt: new Date().toISOString(),
    budgetVersion: budgetDocument.version,
    baseline: budgetDocument.baseline,
    budget: budgetDocument.bundle,
    metrics,
    entry,
    largestJsAssets: [...jsFiles]
      .sort((left, right) => right.gzipBytes - left.gzipBytes)
      .slice(0, 10),
    evaluation,
  };
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(2)} KiB`;
}

export function formatBundleSummary(report) {
  const { metrics } = report;
  return [
    `entry JS: ${formatBytes(metrics.entryJsRawBytes)} raw / ${formatBytes(metrics.entryJsGzipBytes)} gzip`,
    `total JS gzip: ${formatBytes(metrics.totalJsGzipBytes)}`,
    `total CSS: ${formatBytes(metrics.totalCssRawBytes)} raw / ${formatBytes(metrics.totalCssGzipBytes)} gzip`,
    `total dist gzip: ${formatBytes(metrics.totalDistGzipBytes)}`,
    `assets: ${metrics.assetCount} total / ${metrics.jsAssetCount} JS`,
  ].join('\n');
}

function main() {
  const report = analyzeBundle();
  mkdirSync(path.dirname(DEFAULT_REPORT_PATH), { recursive: true });
  writeFileSync(DEFAULT_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log('Phase 14 bundle performance report');
  console.log(formatBundleSummary(report));
  if (!report.evaluation.pass) {
    const details = report.evaluation.failures
      .map(({ metric, actual, limit, reason }) => `${metric}: ${actual} > ${limit}${reason ? ` (${reason})` : ''}`)
      .join('\n');
    throw new Error(`Performance bundle budget exceeded:\n${details}`);
  }
  console.log('Bundle performance budgets passed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
