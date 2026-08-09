import { useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  Filter,
  GitCommitHorizontal,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { OBSERVABILITY_STAGE_ORDER } from './observabilityApi.js';

const EMPTY_CYCLES = Object.freeze([]);

const STAGE_LABELS = {
  scanner: ['Scanner', 'Scanner'],
  backtest: ['Backtest', 'Backtest'],
  market_regime: ['สภาวะตลาด', 'Market Regime'],
  portfolio: ['พอร์ต', 'Portfolio'],
  profit: ['กำไร', 'Profit'],
  risk: ['ความเสี่ยง', 'Risk'],
  execution: ['ส่งคำสั่ง', 'Execution'],
};

const STATUS_LABELS = {
  blocked: ['ถูกบล็อก', 'Blocked'],
  executed: ['ดำเนินการแล้ว', 'Executed'],
  approved: ['อนุมัติ', 'Approved'],
  eligible: ['มีสิทธิ์ไปต่อ', 'Eligible'],
  backtest_passed: ['Backtest ผ่าน', 'Backtest passed'],
  not_selected: ['ไม่ถูกเลือก', 'Not selected'],
  unknown: ['ไม่ทราบ', 'Unknown'],
};

const REASON_COPY = {
  no_preselected_backtest_symbols: ['ไม่มี Symbol ผ่านไปถึง Backtest', 'No symbols reached Backtest'],
  scheduled_paper_cycle_not_authorized: ['Safety gate ปิดรอบตามเวลา', 'Scheduled cycle blocked by safety gate'],
  market_closed: ['ตลาดปิด', 'Market closed'],
  no_eligible_strategy: ['ไม่มี Strategy ผ่าน Backtest', 'No Backtest strategy qualified'],
  investability_market_cap_below_minimum: ['Market cap ต่ำกว่าเกณฑ์', 'Market cap below minimum'],
  investability_average_dollar_volume_below_minimum: ['Dollar volume ต่ำกว่าเกณฑ์', 'Dollar volume below minimum'],
  investability_spread_missing: ['ไม่มีหลักฐาน spread ครบถ้วน', 'Spread evidence unavailable'],
  evidence_gate_failed: ['Evidence gate ไม่ผ่าน', 'Evidence gate failed'],
  new_entry_not_allowed: ['ไม่อนุญาตเปิด Position ใหม่', 'New entry not allowed'],
  risk_rejected: ['Risk gate ปฏิเสธ', 'Risk gate rejected'],
  execution_failed: ['Execution ล้มเหลวแบบ fail-closed', 'Execution failed closed'],
};

function localized(map, key, language) {
  const row = map[key];
  if (!row) return key || '—';
  return row[language === 'th' ? 0 : 1];
}

function formatDate(value, language) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function cycleKey(cycle, index) {
  return cycle.cycleId || cycle.correlationId || String(cycle.workflowRunId || cycle.observedAt || index);
}

function candidateMatches(candidate, filters) {
  if (filters.symbol !== 'all' && candidate.symbol !== filters.symbol) return false;
  if (filters.status !== 'all' && candidate.status !== filters.status) return false;
  if (filters.stage !== 'all' && candidate.stageReached !== filters.stage) return false;
  return true;
}

function cycleMatches(cycle, filters) {
  const noCandidateFilter = filters.symbol === 'all' && filters.status === 'all' && filters.stage === 'all';
  if (noCandidateFilter) return true;
  return cycle.candidates.some((candidate) => candidateMatches(candidate, filters));
}

function CandidateDetail({ candidate, language }) {
  if (!candidate) return null;
  return (
    <div className="history-candidate-detail" data-testid="decision-history-candidate-detail">
      <div className="history-detail-heading">
        <div>
          <span>Symbol drill-down</span>
          <strong>{candidate.symbol}</strong>
        </div>
        <span className={`observability-result status-${candidate.status}`}>
          {localized(STATUS_LABELS, candidate.status, language)}
        </span>
      </div>
      <dl className="history-detail-grid">
        <div><dt>Verdict</dt><dd>{candidate.verdict.toUpperCase()}</dd></div>
        <div><dt>Score</dt><dd>{Number.isFinite(candidate.finalScore) ? candidate.finalScore.toFixed(3) : '—'}</dd></div>
        <div><dt>{language === 'th' ? 'ถึงขั้น' : 'Reached'}</dt><dd>{localized(STAGE_LABELS, candidate.stageReached, language)}</dd></div>
        <div><dt>Strategy</dt><dd>{candidate.strategyBucket}</dd></div>
        <div><dt>Decision ID</dt><dd><code>{candidate.refs?.decisionId || '—'}</code></dd></div>
        <div><dt>Position ID</dt><dd><code>{candidate.refs?.positionId || '—'}</code></dd></div>
      </dl>
      <div className="history-reason-box">
        <strong>{language === 'th' ? 'เหตุผลจาก Manager' : 'Manager reason codes'}</strong>
        {candidate.reasonCodes.length ? (
          <ul>{candidate.reasonCodes.map((code) => <li key={code}>{localized(REASON_COPY, code, language)}</li>)}</ul>
        ) : <span>—</span>}
      </div>
    </div>
  );
}

export default function DecisionHistoryPanel({ history, language = 'th' }) {
  const cycles = history?.cycles ?? EMPTY_CYCLES;
  const [filters, setFilters] = useState({ symbol: 'all', status: 'all', stage: 'all' });
  const [selectedCycleKey, setSelectedCycleKey] = useState(null);
  const [selectedCandidateSymbol, setSelectedCandidateSymbol] = useState(null);

  const symbols = useMemo(() => (
    [...new Set(cycles.flatMap((cycle) => cycle.candidates.map((candidate) => candidate.symbol)))].sort()
  ), [cycles]);
  const filteredCycles = useMemo(
    () => cycles.filter((cycle) => cycleMatches(cycle, filters)),
    [cycles, filters],
  );

  if (!history) return null;

  const selectedCycle = filteredCycles.find((cycle, index) => cycleKey(cycle, index) === selectedCycleKey)
    || filteredCycles[0]
    || null;
  const matchingCandidates = selectedCycle
    ? selectedCycle.candidates.filter((candidate) => candidateMatches(candidate, filters))
    : [];
  const selectedCandidate = matchingCandidates.find((candidate) => candidate.symbol === selectedCandidateSymbol)
    || matchingCandidates[0]
    || null;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedCycleKey(null);
    setSelectedCandidateSymbol(null);
  };

  return (
    <section className="panel decision-history-panel" aria-labelledby="decision-history-title" data-testid="decision-history-panel">
      <div className="observability-heading history-heading">
        <div>
          <p className="eyebrow"><CalendarClock aria-hidden="true" /> Phase 17</p>
          <h2 id="decision-history-title">{language === 'th' ? 'ประวัติการตัดสินใจและ Drill-down' : 'Decision history and drill-down'}</h2>
          <p>{language === 'th'
            ? `เก็บสูงสุด ${history.retentionCycles} รอบจาก Manager_Agent แบบ read-only`
            : `Up to ${history.retentionCycles} read-only cycles retained by Manager_Agent.`}</p>
        </div>
        <div className="history-retention" data-testid="decision-history-count">
          <span>{language === 'th' ? 'รอบที่มี' : 'Cycles available'}</span>
          <strong>{cycles.length}/{history.retentionCycles}</strong>
        </div>
      </div>

      <div className="history-filters" aria-label={language === 'th' ? 'ตัวกรองประวัติการตัดสินใจ' : 'Decision history filters'}>
        <Filter aria-hidden="true" />
        <label>
          <span>Symbol</span>
          <select data-testid="decision-history-symbol-filter" value={filters.symbol} onChange={(event) => updateFilter('symbol', event.target.value)}>
            <option value="all">{language === 'th' ? 'ทั้งหมด' : 'All'}</option>
            {symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
          </select>
        </label>
        <label>
          <span>{language === 'th' ? 'ผล' : 'Result'}</span>
          <select data-testid="decision-history-status-filter" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">{language === 'th' ? 'ทั้งหมด' : 'All'}</option>
            {Object.keys(STATUS_LABELS).map((status) => <option key={status} value={status}>{localized(STATUS_LABELS, status, language)}</option>)}
          </select>
        </label>
        <label>
          <span>{language === 'th' ? 'ขั้นที่ถึง' : 'Stage reached'}</span>
          <select data-testid="decision-history-stage-filter" value={filters.stage} onChange={(event) => updateFilter('stage', event.target.value)}>
            <option value="all">{language === 'th' ? 'ทั้งหมด' : 'All'}</option>
            {OBSERVABILITY_STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{localized(STAGE_LABELS, stage, language)}</option>)}
          </select>
        </label>
      </div>

      {filteredCycles.length ? (
        <div className="history-layout">
          <nav className="history-cycle-list" aria-label={language === 'th' ? 'รอบการตัดสินใจย้อนหลัง' : 'Historical decision cycles'} data-testid="decision-history-cycle-list">
            {filteredCycles.map((cycle, index) => {
              const key = cycleKey(cycle, index);
              const selected = selectedCycle && key === cycleKey(selectedCycle, filteredCycles.indexOf(selectedCycle));
              return (
                <button
                  key={key}
                  type="button"
                  className={`history-cycle-button${selected ? ' selected' : ''}`}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => {
                    setSelectedCycleKey(key);
                    setSelectedCandidateSymbol(null);
                  }}
                  data-testid={`decision-history-cycle-${index}`}
                >
                  <span><GitCommitHorizontal aria-hidden="true" /> {formatDate(cycle.observedAt, language)}</span>
                  <strong>{cycle.status}</strong>
                  <small>{cycle.summary.candidateCount} candidates · {cycle.summary.blockedCount} blocked · {cycle.summary.executedCount} executed</small>
                  <ChevronRight aria-hidden="true" />
                </button>
              );
            })}
          </nav>

          <div className="history-drilldown" data-testid="decision-history-drilldown">
            {selectedCycle ? (
              <>
                <div className="history-cycle-meta">
                  <div><span>Correlation ID</span><code>{selectedCycle.correlationId || '—'}</code></div>
                  <div><span>Cycle ID</span><code>{selectedCycle.cycleId || '—'}</code></div>
                  <div><span>Workflow run</span><strong>#{selectedCycle.workflowRunId || '—'}</strong></div>
                  <div><span>{language === 'th' ? 'สถานะ' : 'Status'}</span><strong>{selectedCycle.status}</strong></div>
                </div>

                <ol className="history-stage-path" tabIndex={0} aria-label={language === 'th' ? 'เส้นทาง 7 ขั้นของรอบที่เลือก' : 'Seven-stage path for selected cycle'}>
                  {selectedCycle.stages.map((stage) => (
                    <li key={stage.id} className={`status-${stage.status}`}>
                      <span>{localized(STAGE_LABELS, stage.id, language)}</span>
                      <strong>{stage.status}</strong>
                    </li>
                  ))}
                </ol>

                {matchingCandidates.length ? (
                  <div className="history-candidate-table-wrap" tabIndex={0} role="region" aria-label={language === 'th' ? 'Candidate ในรอบที่เลือก' : 'Candidates in selected cycle'}>
                    <table className="history-candidate-table">
                      <caption className="sr-only">Candidate decision history</caption>
                      <thead><tr><th>Symbol</th><th>Verdict</th><th>Score</th><th>{language === 'th' ? 'ถึงขั้น' : 'Reached'}</th><th>{language === 'th' ? 'ผล' : 'Result'}</th></tr></thead>
                      <tbody>
                        {matchingCandidates.map((candidate) => (
                          <tr key={`${candidate.rank}-${candidate.symbol}`}>
                            <td><button type="button" className="history-symbol-button" onClick={() => setSelectedCandidateSymbol(candidate.symbol)} data-testid={`decision-history-symbol-${candidate.symbol}`}><Search aria-hidden="true" /> {candidate.symbol}</button></td>
                            <td>{candidate.verdict.toUpperCase()}</td>
                            <td>{Number.isFinite(candidate.finalScore) ? candidate.finalScore.toFixed(3) : '—'}</td>
                            <td>{localized(STAGE_LABELS, candidate.stageReached, language)}</td>
                            <td>{localized(STATUS_LABELS, candidate.status, language)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="history-empty" role="status"><ShieldAlert aria-hidden="true" /> {language === 'th' ? 'ไม่มี Candidate ตรงกับตัวกรองในรอบนี้' : 'No candidates match the active filters in this cycle.'}</div>
                )}
                <CandidateDetail candidate={selectedCandidate} language={language} />
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="history-empty" role="status" data-testid="decision-history-empty">
          <ShieldAlert aria-hidden="true" />
          {language === 'th' ? 'ไม่พบ Decision cycle ที่ตรงกับตัวกรอง' : 'No decision cycles match the active filters.'}
        </div>
      )}
    </section>
  );
}
