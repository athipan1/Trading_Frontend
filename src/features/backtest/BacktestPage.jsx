import {
  Activity,
  ChartSpline,
  CircleDollarSign,
  FlaskConical,
  Gauge,
  History,
  Play,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import { formatBangkokDateTime } from '../../utils/dateTime.js';
import { formatCurrency, pnlClassName } from '../../utils/formatters.js';
import {
  BACKTEST_STRATEGIES,
  deriveBacktestWorkspace,
  validateBacktestRunRequest,
} from './backtestModel.js';

function displayNumber(value, unavailable, digits = 2) {
  return value === null || value === undefined ? unavailable : Number(value).toFixed(digits);
}

function displayPercent(value, unavailable) {
  return value === null || value === undefined ? unavailable : `${Number(value).toFixed(1)}%`;
}

function initialForm(run, generatedAt) {
  const curve = run?.equityCurve || [];
  return {
    strategy: BACKTEST_STRATEGIES.includes(run?.strategy) ? run.strategy : BACKTEST_STRATEGIES[0],
    symbols: run?.symbols?.join(', ') || '',
    startDate: String(curve[0]?.timestamp || generatedAt || '2026-01-01').slice(0, 10),
    endDate: String(curve.at(-1)?.timestamp || generatedAt || '2026-12-31').slice(0, 10),
    initialCapital: String(run?.initialCapital ?? 50_000),
  };
}

function safeRunMessage(error, fallback) {
  const source = typeof error?.message === 'string' ? error.message : fallback;
  return Array.from(source, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
}

function MetricCard({ icon: Icon, label, value, detail, tone = '' }) {
  return (
    <article className={`backtest-metric-card ${tone}`}>
      <span><Icon aria-hidden="true" /></span>
      <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
    </article>
  );
}

function ProfitCurve({ workspace, language, t }) {
  const { curve, latestRun } = workspace;
  return (
    <article className="panel backtest-curve-panel" data-testid="backtest-profit-curve">
      <div className="section-heading">
        <div><p className="eyebrow">{t.backtestPerformance}</p><h2>{t.profitCurve}</h2></div>
        <ChartSpline aria-hidden="true" />
      </div>
      {curve.points.length ? (
        <>
          <div className="backtest-curve-summary">
            <div><span>{t.startingCapital}</span><strong>{formatCurrency(latestRun.initialCapital)}</strong></div>
            <div><span>{t.finalEquity}</span><strong>{formatCurrency(latestRun.finalEquity)}</strong></div>
            <div><span>{t.totalReturn}</span><strong className={pnlClassName(curve.changePercent)}>{displayPercent(curve.changePercent, t.telemetryUnavailable)}</strong></div>
          </div>
          <div className="backtest-chart-frame">
            <svg viewBox="0 0 100 100" role="img" aria-labelledby="profit-curve-title profit-curve-description" preserveAspectRatio="none">
              <title id="profit-curve-title">{t.profitCurve}</title>
              <desc id="profit-curve-description">{t.profitCurveDescription}</desc>
              <defs>
                <linearGradient id="profit-curve-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="backtest-chart-area" d={curve.areaPath} />
              <path className="backtest-chart-line" d={curve.linePath} />
              {curve.points.map((point) => <circle key={point.timestamp} cx={point.x} cy={point.y} r="1.2" />)}
            </svg>
          </div>
          <div className="backtest-chart-axis">
            <span>{formatBangkokDateTime(curve.points[0].timestamp, language, t.telemetryUnavailable)}</span>
            <span>{formatBangkokDateTime(curve.points.at(-1).timestamp, language, t.telemetryUnavailable)}</span>
          </div>
        </>
      ) : (
        <EmptyState icon={ChartSpline} title={t.noProfitCurve} description={t.noProfitCurveDescription} testId="backtest-curve-empty" />
      )}
    </article>
  );
}

function BacktestRunForm({ latestRun, generatedAt, managerControlAvailable, canRunBacktest, onRunBacktest, t }) {
  const [form, setForm] = useState(() => initialForm(latestRun, generatedAt));
  const [runState, setRunState] = useState({ state: 'idle', message: '' });
  const seededRunId = useRef(null);

  useEffect(() => {
    if (!latestRun?.id || seededRunId.current === latestRun.id) return;
    seededRunId.current = latestRun.id;
    setForm(initialForm(latestRun, generatedAt));
  }, [generatedAt, latestRun]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const disabledReason = !managerControlAvailable
    ? t.backtestPublicReadOnly
    : !canRunBacktest ? t.backtestCapabilityRequired : '';

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateBacktestRunRequest(form);
    if (!validation.ok) {
      setRunState({ state: 'error', message: t.backtestValidationErrors[validation.error] });
      return;
    }
    if (!canRunBacktest) {
      setRunState({ state: 'error', message: disabledReason });
      return;
    }
    setRunState({ state: 'running', message: t.backtestSubmitting });
    try {
      const response = await onRunBacktest(validation.value);
      const run = response?.data || response || {};
      const reference = run.id || run.run_id || run.status || t.backtestAccepted;
      setRunState({ state: 'success', message: `${t.backtestAccepted}: ${reference}` });
    } catch (error) {
      setRunState({ state: 'error', message: safeRunMessage(error, t.backtestRunFailed) });
    }
  };

  return (
    <section className="panel backtest-run-panel" aria-labelledby="backtest-run-heading">
      <div className="section-heading">
        <div><p className="eyebrow">{t.managerControl}</p><h2 id="backtest-run-heading">{t.runBacktest}</h2></div>
        <Play aria-hidden="true" />
      </div>
      <p className="backtest-run-boundary">{t.backtestRunBoundary}</p>
      <form onSubmit={submit}>
        <label><span>{t.backtestStrategy}</span><select value={form.strategy} onChange={update('strategy')}>{BACKTEST_STRATEGIES.map((strategy) => <option key={strategy} value={strategy}>{t.backtestStrategies[strategy]}</option>)}</select></label>
        <label><span>{t.backtestSymbols}</span><input value={form.symbols} onChange={update('symbols')} placeholder="AAPL, MSFT" autoComplete="off" /></label>
        <label><span>{t.backtestStartDate}</span><input type="date" value={form.startDate} onChange={update('startDate')} /></label>
        <label><span>{t.backtestEndDate}</span><input type="date" value={form.endDate} onChange={update('endDate')} /></label>
        <label><span>{t.startingCapital}</span><input type="number" min="100" max="1000000000" step="100" value={form.initialCapital} onChange={update('initialCapital')} /></label>
        <button type="submit" disabled={!canRunBacktest || runState.state === 'running'}><Play aria-hidden="true" /><span>{runState.state === 'running' ? t.backtestSubmitting : t.runBacktest}</span></button>
      </form>
      {disabledReason ? <p className="backtest-disabled-reason">{disabledReason}</p> : null}
      {runState.message ? <div className={`backtest-run-status ${runState.state}`} role="status">{runState.message}</div> : null}
    </section>
  );
}

function HistoryView({ history, language, t }) {
  if (!history.length) return <EmptyState icon={History} title={t.noBacktestHistory} description={t.noBacktestHistoryDescription} testId="backtest-history-empty" />;
  return (
    <>
      <div className="backtest-table-wrap" role="region" aria-label={t.backtestHistoryTable} tabIndex="0" data-testid="backtest-history-table">
        <table><thead><tr><th scope="col">{t.backtestRun}</th><th scope="col">{t.backtestStrategy}</th><th scope="col">{t.agentStatus}</th><th scope="col">{t.sharpe}</th><th scope="col">{t.winRate}</th><th scope="col">{t.drawdown}</th><th scope="col">{t.completed}</th></tr></thead>
          <tbody>{history.map((run) => <tr key={run.id || `${run.strategy}-${run.startedAt}`}><td>{run.id || '—'}</td><td>{t.backtestStrategies[run.strategy] || run.strategy}</td><td><span className={`backtest-status ${run.status}`}>{run.status}</span></td><td>{displayNumber(run.statistics.sharpeRatio, '—')}</td><td>{displayPercent(run.statistics.winRatePercent, '—')}</td><td>{displayPercent(run.statistics.maxDrawdownPercent, '—')}</td><td>{formatBangkokDateTime(run.completedAt, language, '—')}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="backtest-card-list" data-testid="backtest-history-cards">{history.map((run) => <article key={run.id || `${run.strategy}-${run.startedAt}`}><div><strong>{run.id || t.backtestRun}</strong><span className={`backtest-status ${run.status}`}>{run.status}</span></div><dl><div><dt>{t.backtestStrategy}</dt><dd>{t.backtestStrategies[run.strategy] || run.strategy}</dd></div><div><dt>{t.sharpe}</dt><dd>{displayNumber(run.statistics.sharpeRatio, '—')}</dd></div><div><dt>{t.winRate}</dt><dd>{displayPercent(run.statistics.winRatePercent, '—')}</dd></div><div><dt>{t.drawdown}</dt><dd>{displayPercent(run.statistics.maxDrawdownPercent, '—')}</dd></div><div className="wide"><dt>{t.completed}</dt><dd>{formatBangkokDateTime(run.completedAt, language, '—')}</dd></div></dl></article>)}</div>
    </>
  );
}

function TradeView({ trades, language, t }) {
  if (!trades.length) return <EmptyState icon={Activity} title={t.noBacktestTrades} description={t.noBacktestTradesDescription} testId="backtest-trades-empty" />;
  return (
    <>
      <div className="backtest-table-wrap" role="region" aria-label={t.backtestTradeTable} tabIndex="0" data-testid="backtest-trade-table">
        <table><thead><tr><th scope="col">{t.symbol}</th><th scope="col">{t.orderSide}</th><th scope="col">{t.qty}</th><th scope="col">{t.backtestEntry}</th><th scope="col">{t.backtestExit}</th><th scope="col">{t.pnl}</th><th scope="col">{t.agentStatus}</th></tr></thead>
          <tbody>{trades.map((trade, index) => <tr key={trade.id || `${trade.symbol}-${index}`}><td><strong>{trade.symbol}</strong></td><td>{trade.side}</td><td>{displayNumber(trade.quantity, '—', 0)}</td><td>{displayNumber(trade.entryPrice, '—')}<small>{formatBangkokDateTime(trade.entryAt, language, '—')}</small></td><td>{displayNumber(trade.exitPrice, '—')}<small>{formatBangkokDateTime(trade.exitAt, language, '—')}</small></td><td className={pnlClassName(trade.pnl)}>{trade.pnl === null ? '—' : formatCurrency(trade.pnl)}</td><td><span className={`backtest-status ${trade.status}`}>{trade.status}</span></td></tr>)}</tbody>
        </table>
      </div>
      <div className="backtest-card-list" data-testid="backtest-trade-cards">{trades.map((trade, index) => <article key={trade.id || `${trade.symbol}-${index}`}><div><strong>{trade.symbol}</strong><span className={`backtest-status ${trade.status}`}>{trade.status}</span></div><dl><div><dt>{t.orderSide}</dt><dd>{trade.side}</dd></div><div><dt>{t.qty}</dt><dd>{displayNumber(trade.quantity, '—', 0)}</dd></div><div><dt>{t.backtestEntry}</dt><dd>{displayNumber(trade.entryPrice, '—')}</dd></div><div><dt>{t.backtestExit}</dt><dd>{displayNumber(trade.exitPrice, '—')}</dd></div><div className="wide"><dt>{t.pnl}</dt><dd className={pnlClassName(trade.pnl)}>{trade.pnl === null ? '—' : formatCurrency(trade.pnl)}</dd></div></dl></article>)}</div>
    </>
  );
}

export default function BacktestPage({ snapshot, language, t, managerControlAvailable, canRunBacktest, onRunBacktest }) {
  const workspace = useMemo(() => deriveBacktestWorkspace(snapshot), [snapshot]);
  const statistics = workspace.statistics;
  const latestRun = workspace.latestRun;
  return (
    <div className="page-stack backtest-workspace" data-testid="page-backtest">
      <section className="backtest-boundary">
        <span><ShieldCheck aria-hidden="true" /></span>
        <div><p className="eyebrow">{t.backtestBoundaryEyebrow}</p><h2>{t.backtestBoundaryTitle}</h2><p>{t.backtestBoundaryDescription}</p></div>
        <span className="status good">{t.managerOnly}</span>
      </section>

      {!workspace.dataPublished ? <div className="backtest-contract-notice" role="status"><FlaskConical aria-hidden="true" /><div><strong>{t.backtestPendingTitle}</strong><p>{t.backtestPendingDescription}</p></div></div> : null}

      <BacktestRunForm latestRun={latestRun} generatedAt={snapshot.generatedAt} managerControlAvailable={managerControlAvailable} canRunBacktest={canRunBacktest} onRunBacktest={onRunBacktest} t={t} />

      <section className="backtest-metric-grid" aria-label={t.backtestStatistics}>
        <MetricCard icon={Gauge} label={t.sharpe} value={displayNumber(statistics.sharpeRatio, t.telemetryUnavailable)} detail={t.riskAdjustedReturn} />
        <MetricCard icon={Target} label={t.winRate} value={displayPercent(statistics.winRatePercent, t.telemetryUnavailable)} detail={`${displayNumber(statistics.totalTrades, '—', 0)} ${t.backtestTrades.toLowerCase()}`} />
        <MetricCard icon={Activity} label={t.drawdown} value={displayPercent(statistics.maxDrawdownPercent, t.telemetryUnavailable)} detail={t.maximumObserved} tone="warning" />
        <MetricCard icon={CircleDollarSign} label={t.netProfit} value={statistics.netProfit === null ? t.telemetryUnavailable : formatCurrency(statistics.netProfit)} detail={latestRun?.status || t.telemetryUnavailable} tone={pnlClassName(statistics.netProfit)} />
      </section>

      <ProfitCurve workspace={workspace} language={language} t={t} />

      <section className="panel backtest-record-panel" aria-labelledby="backtest-history-heading">
        <div className="section-heading"><div><p className="eyebrow">{t.previousRuns}</p><h2 id="backtest-history-heading">{t.backtestHistory}</h2></div><span className="pill">{workspace.history.length}</span></div>
        <HistoryView history={workspace.history} language={language} t={t} />
      </section>

      <section className="panel backtest-record-panel" aria-labelledby="backtest-trades-heading">
        <div className="section-heading"><div><p className="eyebrow">{t.latestCompletedRun}</p><h2 id="backtest-trades-heading">{t.backtestTrades}</h2></div><span className="pill">{workspace.trades.length}</span></div>
        <TradeView trades={workspace.trades} language={language} t={t} />
      </section>
    </div>
  );
}
