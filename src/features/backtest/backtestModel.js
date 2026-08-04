export const BACKTEST_STRATEGIES = Object.freeze([
  'value_rebound',
  'momentum',
  'mean_reversion',
]);

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedSymbols(value) {
  const candidates = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(candidates
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter(Boolean))];
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function validateBacktestRunRequest(input = {}) {
  const strategy = String(input.strategy || '').trim();
  if (!BACKTEST_STRATEGIES.includes(strategy)) return { ok: false, error: 'strategy' };
  const symbols = normalizedSymbols(input.symbols);
  if (
    symbols.length === 0
      || symbols.length > 20
      || symbols.some((symbol) => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))
  ) return { ok: false, error: 'symbols' };
  const startDate = String(input.startDate || '');
  const endDate = String(input.endDate || '');
  if (!validIsoDate(startDate) || !validIsoDate(endDate) || startDate >= endDate) {
    return { ok: false, error: 'dates' };
  }
  const initialCapital = finiteNumberOrNull(input.initialCapital);
  if (initialCapital === null || initialCapital < 100 || initialCapital > 1_000_000_000) {
    return { ok: false, error: 'capital' };
  }
  return {
    ok: true,
    value: { strategy, symbols, startDate, endDate, initialCapital },
  };
}

function deriveCurve(points = []) {
  const curve = points
    .map((point) => ({
      ...point,
      equity: finiteNumberOrNull(point?.equity),
    }))
    .filter((point) => point.timestamp && point.equity !== null);
  if (curve.length === 0) {
    return { points: [], linePath: '', areaPath: '', min: null, max: null, changePercent: null };
  }
  const equities = curve.map((point) => point.equity);
  const min = Math.min(...equities);
  const max = Math.max(...equities);
  const range = max - min || 1;
  const plotted = curve.map((point, index) => ({
    ...point,
    x: curve.length === 1 ? 50 : (index / (curve.length - 1)) * 100,
    y: 90 - (((point.equity - min) / range) * 80),
  }));
  const linePath = plotted.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  )).join(' ');
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;
  const first = plotted[0].equity;
  const last = plotted.at(-1).equity;
  return {
    points: plotted,
    linePath,
    areaPath,
    min,
    max,
    changePercent: first > 0 ? ((last - first) / first) * 100 : null,
  };
}

export function deriveBacktestWorkspace(snapshot = {}) {
  const backtest = snapshot.backtest || null;
  const latestRun = backtest?.latestRun || null;
  const history = Array.isArray(backtest?.history) ? backtest.history : [];
  const trades = Array.isArray(latestRun?.trades) ? latestRun.trades : [];
  return {
    dataPublished: Boolean(backtest),
    latestRun,
    history,
    trades,
    curve: deriveCurve(latestRun?.equityCurve),
    statistics: latestRun?.statistics || {
      sharpeRatio: null,
      winRatePercent: null,
      maxDrawdownPercent: null,
      netProfit: null,
      totalTrades: null,
    },
  };
}
