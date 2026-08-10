import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import DecisionHistoryPanel from './DecisionHistoryPanel.jsx';
import HumanDecisionExplanation from './HumanDecisionExplanation.jsx';
import PipelineReliabilityPanel from './PipelineReliabilityPanel.jsx';
import { getTradingDecisionData } from './observabilityApi.js';
import { explainDecisionReason } from './reasonExplanations.js';

const DecisionAnalyticsPanel = lazy(() => import('./DecisionAnalyticsPanel.jsx'));

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
  success: ['ผ่าน', 'Passed'],
  warning: ['เตือน', 'Warning'],
  blocked: ['บล็อก', 'Blocked'],
  skipped: ['ข้าม', 'Skipped'],
  not_attempted: ['ยังไม่ทำ', 'Not attempted'],
  failure: ['ล้มเหลว', 'Failed'],
  not_selected: ['ไม่ถูกเลือก', 'Not selected'],
  eligible: ['มีสิทธิ์ไปต่อ', 'Eligible'],
  backtest_passed: ['Backtest ผ่าน', 'Backtest passed'],
  approved: ['อนุมัติ', 'Approved'],
  executed: ['ดำเนินการแล้ว', 'Executed'],
  unknown: ['ไม่ทราบ', 'Unknown'],
};

function label(map, key, language) {
  const value = map[key];
  if (!value) return key || '—';
  return value[language === 'th' ? 0 : 1];
}

function reasonText(code, language, stage = null) {
  return explainDecisionReason(code, { language, stage }).title;
}

function StatusIcon({ status }) {
  if (status === 'success' || status === 'executed' || status === 'approved' || status === 'backtest_passed') {
    return <CheckCircle2 aria-hidden="true" />;
  }
  if (status === 'blocked' || status === 'failure') return <ShieldAlert aria-hidden="true" />;
  if (status === 'warning') return <TriangleAlert aria-hidden="true" />;
  if (status === 'skipped' || status === 'not_attempted' || status === 'not_selected') return <Ban aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

function CandidateReasons({ candidate, language }) {
  if (!candidate.reasonCodes.length) return <span>—</span>;
  return (
    <HumanDecisionExplanation
      codes={candidate.reasonCodes}
      language={language}
      stage={candidate.stageReached}
      compact
      testId={`human-explanation-${candidate.symbol}`}
    />
  );
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

export default function TradingObservabilityPanel({ language = 'th' }) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    getTradingDecisionData({ signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, []);

  const selected = useMemo(() => {
    const current = state.data?.observability?.current;
    if (current?.source === 'workflow_metadata' && state.data?.observability?.lastMeaningful) {
      return { cycle: state.data.observability.lastMeaningful, showingLastMeaningful: true, current };
    }
    return { cycle: current, showingLastMeaningful: false, current };
  }, [state.data]);

  if (state.loading || (!state.data && !state.error)) return null;

  if (state.error) {
    return (
      <section className="panel observability-panel observability-unavailable" role="status" data-testid="trading-observability-unavailable">
        <strong>{language === 'th' ? 'Decision observability ยังไม่พร้อม' : 'Decision observability unavailable'}</strong>
        <span>{String(state.error.message || '').slice(0, 180)}</span>
      </section>
    );
  }

  const cycle = selected.cycle;
  if (!cycle) return null;
  const blockedCount = cycle.candidates.filter((candidate) => candidate.status === 'blocked').length;
  const stageListLabel = language === 'th' ? 'เส้นทางการตัดสินใจ 7 ขั้น' : 'Seven-stage trading decision path';
  const candidateTableLabel = language === 'th' ? 'ตารางเหตุผลของ Candidate' : 'Candidate decision reasons';

  return (
    <>
      <section className="panel observability-panel" aria-labelledby="trading-observability-title" data-testid="trading-observability-panel">
        <div className="observability-heading">
          <div>
            <p className="eyebrow"><GitBranch aria-hidden="true" /> Phase 20</p>
            <h2 id="trading-observability-title">{language === 'th' ? 'ทำไมระบบถึงตัดสินใจแบบนี้' : 'Why the system made this decision'}</h2>
            <p>{language === 'th'
              ? 'แปล reason code จาก Manager_Agent เป็นภาษาธรรมชาติแบบ deterministic โดย Frontend ไม่แต่งเหตุผลใหม่เอง'
              : 'Manager_Agent reason codes are translated into deterministic plain language; the Frontend does not invent rationale.'}</p>
          </div>
          <div className="observability-correlation" data-testid="observability-correlation">
            <span>Correlation ID</span>
            <code>{cycle.correlationId || '—'}</code>
          </div>
        </div>

        {selected.showingLastMeaningful ? (
          <div className="observability-context-note" role="status" data-testid="observability-last-meaningful-note">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>{language === 'th' ? 'รอบปัจจุบันไม่มี trading artifact' : 'Current run has no trading artifact'}</strong>
              <span>{reasonText(selected.current?.reasonCode, language)}. {language === 'th' ? 'ด้านล่างคือรอบตัดสินใจจริงล่าสุด' : 'Showing the latest meaningful decision cycle below.'}</span>
            </div>
          </div>
        ) : null}

        <div className="observability-facts">
          <div><span>{language === 'th' ? 'สถานะรอบ' : 'Cycle status'}</span><strong>{cycle.status}</strong></div>
          <div><span>{language === 'th' ? 'ผู้สมัคร' : 'Candidates'}</span><strong>{cycle.candidates.length}</strong></div>
          <div><span>{language === 'th' ? 'ถูกบล็อก' : 'Blocked'}</span><strong>{blockedCount}</strong></div>
          <div><span>Workflow run</span><strong>#{cycle.workflowRunId ?? '—'}</strong></div>
        </div>

        <div className="observability-stage-section">
          <h3>{language === 'th' ? 'เส้นทางการตัดสินใจ' : 'Decision path'}</h3>
          <ol
            className="observability-stages"
            data-testid="observability-stage-list"
            tabIndex={0}
            aria-label={stageListLabel}
          >
            {cycle.stages.map((stage) => (
              <li key={stage.id} className={`observability-stage status-${stage.status}`} data-testid={`observability-stage-${stage.id}`}>
                <StatusIcon status={stage.status} />
                <div>
                  <strong>{label(STAGE_LABELS, stage.id, language)}</strong>
                  <span>{label(STATUS_LABELS, stage.status, language)}</span>
                  {stage.reasonCodes.length ? <small>{reasonText(stage.reasonCodes[0], language, stage.id)}</small> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="observability-candidates-section">
          <div className="observability-section-title">
            <h3>{language === 'th' ? 'คำอธิบายแบบภาษาคนของแต่ละ Candidate' : 'Plain-language candidate explanations'}</h3>
            <span>{cycle.candidates.length}/10</span>
          </div>
          {cycle.candidates.length ? (
            <div className="observability-table-wrap" tabIndex={0} role="region" aria-label={candidateTableLabel}>
              <table className="observability-table">
                <caption className="sr-only">{candidateTableLabel}</caption>
                <thead><tr>
                  <th>{language === 'th' ? 'อันดับ' : 'Rank'}</th>
                  <th>Symbol</th>
                  <th>Verdict</th>
                  <th>Score</th>
                  <th>{language === 'th' ? 'ถึงขั้น' : 'Reached'}</th>
                  <th>{language === 'th' ? 'ผล' : 'Result'}</th>
                  <th>{language === 'th' ? 'เกิดอะไรขึ้น / ทำไม' : 'What happened / Why'}</th>
                </tr></thead>
                <tbody>
                  {cycle.candidates.map((candidate) => (
                    <tr key={`${candidate.rank}-${candidate.symbol}`} data-testid={`observability-candidate-${candidate.symbol}`}>
                      <td>#{candidate.rank ?? '—'}</td>
                      <td><strong>{candidate.symbol}</strong><small>{candidate.strategyBucket}</small></td>
                      <td>{candidate.verdict.toUpperCase()}</td>
                      <td>{formatScore(candidate.finalScore)}</td>
                      <td>{label(STAGE_LABELS, candidate.stageReached, language)}</td>
                      <td><span className={`observability-result status-${candidate.status}`}><StatusIcon status={candidate.status} />{label(STATUS_LABELS, candidate.status, language)}</span></td>
                      <td><CandidateReasons candidate={candidate} language={language} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">{language === 'th' ? 'รอบนี้ไม่มี Candidate detail' : 'No candidate detail for this cycle.'}</p>}
        </div>
      </section>
      {state.data?.decisionHistory ? (
        <PipelineReliabilityPanel history={state.data.decisionHistory} language={language} />
      ) : null}
      {state.data?.decisionAnalytics ? (
        <Suspense fallback={null}>
          <DecisionAnalyticsPanel analytics={state.data.decisionAnalytics} language={language} />
        </Suspense>
      ) : null}
      {state.data?.decisionHistory ? (
        <DecisionHistoryPanel history={state.data.decisionHistory} language={language} />
      ) : null}
    </>
  );
}
