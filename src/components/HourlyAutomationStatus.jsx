import { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock3,
  ExternalLink,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

function StatusIcon({ status }) {
  if (status === 'success' || status === 'completed') return <CheckCircle2 aria-hidden="true" />;
  if (status === 'running') return <RefreshCw aria-hidden="true" />;
  if (status === 'pending') return <Clock3 aria-hidden="true" />;
  if (status === 'warning') return <TriangleAlert aria-hidden="true" />;
  if (status === 'failure') return <XCircle aria-hidden="true" />;
  if (status === 'cancelled' || status === 'skipped') return <Ban aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

function IncidentIcon({ severity }) {
  if (severity === 'critical') return <ShieldAlert aria-hidden="true" />;
  if (severity === 'warning') return <TriangleAlert aria-hidden="true" />;
  if (severity === 'normal') return <CheckCircle2 aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

const COPY = {
  th: {
    title: 'สถานะระบบเทรดรายชั่วโมง',
    latestRun: 'รอบล่าสุด',
    runNumber: 'Run',
    trigger: 'รูปแบบการรัน',
    runtime: 'โหมดระบบ',
    workflow: 'Workflow',
    cycle: 'รอบการทำงาน',
    execution: 'การส่งคำสั่ง',
    attempted: 'มีการพยายามส่งคำสั่ง',
    notAttempted: 'ไม่ได้ส่งคำสั่ง',
    reason: 'เหตุผล',
    rawCode: 'รหัสระบบ',
    nextAction: 'สิ่งที่ควรทำต่อ',
    candidates: 'Candidate',
    positions: 'Position',
    orders: 'Open order',
    lastSuccess: 'รอบสำเร็จล่าสุด',
    snapshotAge: 'อายุ Snapshot',
    minutes: 'นาที',
    masked: 'ข้อมูลการเงินถูกปกปิด',
    openRun: 'เปิด GitHub Actions run',
    phases: 'ลำดับการทำงาน',
    refresh: 'รีเฟรชตอนนี้',
    scheduled: 'ตามเวลา',
    manual: 'สั่งรันเอง',
    noData: 'ยังไม่มีข้อมูลรอบการทำงาน',
    loading: 'กำลังโหลดสถานะรายชั่วโมง',
    partialFill: 'พบ Partial fill',
    absolute: 'เวลาไทย',
    relativeNow: 'เมื่อสักครู่',
    safe: 'Paper-only',
    severityCritical: 'วิกฤต',
    severityWarning: 'ต้องตรวจสอบ',
    severityNormal: 'ปกติ',
    severityInfo: 'ข้อมูล',
    showAllPhases: (count) => `ดูทั้ง ${count} ขั้น`,
    showIncidentPhases: 'แสดงเฉพาะขั้นที่ต้องตรวจสอบ',
    noIncidentPhases: 'ไม่มีขั้นที่ล้มเหลวหรือมีคำเตือนในรอบนี้',
    incidents: {
      unsafeRuntime: {
        title: 'Runtime ไม่อยู่ในขอบเขตที่ปลอดภัย',
        detail: 'Dashboard ตรวจพบโหมดที่ไม่ใช่ Paper หรือ Simulator หรือพบ liveTradingEnabled=true',
        action: 'หยุดการเปิดใช้งาน Production และตรวจค่า Runtime กับ Manager_Agent ก่อนรอบถัดไป',
      },
      partialFill: {
        title: 'พบคำสั่งซื้อขายที่ Fill ไม่ครบ',
        detail: 'สถานะ Position และ Order อาจไม่ตรงกับแผนเดิมจนกว่าจะ Reconcile สำเร็จ',
        action: 'ตรวจ Alpaca Paper, Position, Open Order และ Final Reconciliation ทันที',
      },
      executionFailure: {
        title: 'การส่งคำสั่ง Paper Trading ล้มเหลว',
        detail: 'Execution phase หรือ Paper broker ปฏิเสธคำสั่งในรอบล่าสุด',
        action: 'เปิด GitHub Actions run ตรวจ Broker response แล้วตรวจว่าไม่มี Order ค้างหรือ Position บางส่วน',
      },
      workflowFailure: {
        title: 'Workflow รายชั่วโมงทำงานไม่สำเร็จ',
        detail: 'รอบล่าสุดสิ้นสุดด้วย Failure และอาจยังไม่ผ่าน Final Reconciliation',
        action: 'เปิด GitHub Actions run ตรวจขั้นแรกที่ล้มเหลว และยืนยันสถานะพอร์ตกับโบรกเกอร์',
      },
      cancelled: {
        title: 'Workflow ถูกยกเลิกก่อนจบรอบ',
        detail: 'บางขั้นอาจยังไม่ได้ทำงาน รวมถึงการตรวจสอบหลังส่งคำสั่ง',
        action: 'ตรวจเหตุผลการยกเลิก แล้วรันรอบใหม่เมื่อยืนยันว่าไม่มีคำสั่งค้าง',
      },
      stale: {
        title: 'Snapshot เก่าเกินกำหนด',
        detail: 'ข้อมูลบน Dashboard อาจไม่สะท้อนรอบล่าสุดของ Manager_Agent',
        action: 'ตรวจ Workflow publisher และ GitHub Actions ก่อนใช้ข้อมูลตัดสินใจ',
      },
      phaseWarning: {
        title: 'มีขั้นตอนที่ต้องตรวจสอบ',
        detail: 'Workflow จบได้ แต่มี Phase ที่รายงาน Warning หรือ Failure ภายในรอบ',
        action: 'เปิด Timeline ดู Phase ที่ผิดปกติและตรวจข้อความจาก Agent ที่เกี่ยวข้อง',
      },
      riskRejected: {
        title: 'Risk Agent ไม่อนุมัติคำสั่ง',
        detail: 'ระบบป้องกันความเสี่ยงทำงานตามขอบเขต และไม่มีคำสั่งถูกส่งไปยังโบรกเกอร์',
        action: 'ไม่ต้องดำเนินการทันที ตรวจ Risk reason เฉพาะเมื่อผลลัพธ์ไม่ตรงกับนโยบายที่ตั้งไว้',
      },
      noCandidate: {
        title: 'ไม่มีหุ้นผ่านเงื่อนไขในรอบนี้',
        detail: 'Scanner หรือ Backtest ไม่พบ Candidate ที่ผ่านเกณฑ์ จึงไม่มีการส่งคำสั่ง',
        action: 'รอรอบตามเวลาถัดไป ไม่ควรลดเกณฑ์เพียงเพื่อบังคับให้ระบบเทรด',
      },
      submitted: {
        title: 'ส่งคำสั่ง Paper Trading แล้ว',
        detail: 'คำสั่งผ่าน Risk และถูกส่งเข้าสู่ Paper broker ในรอบล่าสุด',
        action: 'ตรวจ Final Reconciliation และยืนยันว่า Position มี Stop Loss และ Take Profit ครบ',
      },
      healthy: {
        title: 'ระบบทำงานปกติ',
        detail: 'ไม่พบเหตุการณ์วิกฤต คำเตือน หรือข้อมูลเก่าใน Snapshot ล่าสุด',
        action: 'ไม่ต้องดำเนินการ ตรวจรอบถัดไปตามตารางปกติ',
      },
      unknown: {
        title: 'ยังสรุปสถานะไม่ได้',
        detail: 'Snapshot มีข้อมูลไม่เพียงพอสำหรับจัดประเภทเหตุการณ์',
        action: 'ตรวจ Schema, Runtime และ GitHub Actions run ล่าสุด',
      },
    },
    reasons: {
      risk_rejected: 'Risk Agent ไม่อนุมัติคำสั่ง',
      paper_broker_rejected: 'Alpaca Paper ปฏิเสธคำสั่ง',
      no_preselected_backtest_symbols: 'ไม่มีหุ้นผ่านเงื่อนไข Scanner และ Backtest',
      paper_order_submitted: 'ส่งคำสั่งไปยัง Alpaca Paper แล้ว',
      partial_fill: 'คำสั่งถูก Fill เพียงบางส่วน',
    },
  },
  en: {
    title: 'Hourly Automation Status',
    latestRun: 'Latest run',
    runNumber: 'Run',
    trigger: 'Trigger',
    runtime: 'Runtime',
    workflow: 'Workflow',
    cycle: 'Cycle',
    execution: 'Execution',
    attempted: 'Execution attempted',
    notAttempted: 'Not attempted',
    reason: 'Reason',
    rawCode: 'Raw code',
    nextAction: 'Recommended next action',
    candidates: 'Candidates',
    positions: 'Positions',
    orders: 'Open orders',
    lastSuccess: 'Last successful run',
    snapshotAge: 'Snapshot age',
    minutes: 'minutes',
    masked: 'Financial values are masked',
    openRun: 'Open GitHub Actions run',
    phases: 'Execution phases',
    refresh: 'Refresh now',
    scheduled: 'Scheduled',
    manual: 'Manual',
    noData: 'No hourly run data is available yet',
    loading: 'Loading hourly automation status',
    partialFill: 'Partial fill detected',
    absolute: 'Bangkok time',
    relativeNow: 'just now',
    safe: 'Paper-only',
    severityCritical: 'Critical',
    severityWarning: 'Needs review',
    severityNormal: 'Normal',
    severityInfo: 'Information',
    showAllPhases: (count) => `Show all ${count} phases`,
    showIncidentPhases: 'Show incident phases only',
    noIncidentPhases: 'No failed or warning phases were reported in this run.',
    incidents: {
      unsafeRuntime: {
        title: 'Runtime is outside the safe boundary',
        detail: 'The dashboard detected a non-paper, non-simulator mode or liveTradingEnabled=true.',
        action: 'Stop the production rollout and verify Manager_Agent runtime configuration before the next cycle.',
      },
      partialFill: {
        title: 'A partially filled order was detected',
        detail: 'Positions and orders may differ from the original plan until reconciliation completes.',
        action: 'Inspect Alpaca Paper, positions, open orders, and final reconciliation immediately.',
      },
      executionFailure: {
        title: 'Paper-trading execution failed',
        detail: 'The execution phase failed or the paper broker rejected the latest order.',
        action: 'Open the GitHub Actions run, inspect the broker response, and verify that no order or partial position remains.',
      },
      workflowFailure: {
        title: 'The hourly workflow failed',
        detail: 'The latest run ended in failure and may not have completed final reconciliation.',
        action: 'Inspect the first failed phase and verify the portfolio directly against the broker state.',
      },
      cancelled: {
        title: 'The workflow was cancelled before completion',
        detail: 'Some phases may not have run, including post-execution reconciliation.',
        action: 'Confirm why the run was cancelled, then rerun only after checking for outstanding orders.',
      },
      stale: {
        title: 'The dashboard snapshot is stale',
        detail: 'The displayed data may not reflect the latest Manager_Agent cycle.',
        action: 'Check the snapshot publisher and GitHub Actions before using this data for a decision.',
      },
      phaseWarning: {
        title: 'One or more phases need review',
        detail: 'The workflow completed, but an internal phase reported a warning or failure.',
        action: 'Open the timeline, inspect the abnormal phase, and review the related agent message.',
      },
      riskRejected: {
        title: 'Risk Agent rejected the trade',
        detail: 'The safety gate operated as designed and no order was sent to the broker.',
        action: 'No immediate action is required. Review the risk reason only when it conflicts with policy.',
      },
      noCandidate: {
        title: 'No symbol passed this cycle',
        detail: 'Scanner or backtest criteria produced no approved candidate, so execution was skipped.',
        action: 'Wait for the next scheduled cycle. Do not weaken controls merely to force a trade.',
      },
      submitted: {
        title: 'A paper-trading order was submitted',
        detail: 'The order passed Risk and was submitted to the paper broker in the latest cycle.',
        action: 'Verify final reconciliation and confirm that Stop Loss and Take Profit protection are present.',
      },
      healthy: {
        title: 'System operating normally',
        detail: 'No critical incident, warning, or stale-data condition was found in the latest snapshot.',
        action: 'No operator action is required. Continue with the normal schedule.',
      },
      unknown: {
        title: 'System status cannot be classified yet',
        detail: 'The snapshot does not contain enough information to classify the latest cycle.',
        action: 'Verify the schema, runtime, and latest GitHub Actions run.',
      },
    },
    reasons: {
      risk_rejected: 'Risk Agent rejected the trade',
      paper_broker_rejected: 'Alpaca Paper rejected the order',
      no_preselected_backtest_symbols: 'No symbol passed scanner and backtest criteria',
      paper_order_submitted: 'The order was submitted to Alpaca Paper',
      partial_fill: 'The order was only partially filled',
    },
  },
};

const PHASE_LABELS = {
  preflight: ['Preflight', 'Preflight'],
  portfolio_review: ['ตรวจพอร์ต', 'Portfolio Review'],
  protection_reconciliation: ['ตรวจ TP/SL', 'Protection Reconciliation'],
  scanner: ['Scanner', 'Scanner'],
  backtest: ['Backtest', 'Backtest'],
  risk: ['Risk', 'Risk'],
  execution: ['Execution', 'Execution'],
  final_reconciliation: ['ตรวจสอบหลังรัน', 'Final Reconciliation'],
};

const SAFE_RUNTIME_MODES = new Set(['ALPACA_PAPER', 'PAPER', 'PAPER_TRADING', 'SIMULATOR', 'DRY_RUN']);
const INCIDENT_PHASE_STATUSES = new Set(['failure', 'warning', 'cancelled']);

function statusLabel(status) {
  return String(status || 'unknown').replaceAll('_', ' ');
}

function formatAbsolute(value, language) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'medium',
  }).format(new Date(value));
}

function formatRelative(value, language, copy) {
  if (!value) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return copy.relativeNow;
  const formatter = new Intl.RelativeTimeFormat(language === 'th' ? 'th' : 'en', { numeric: 'always' });
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  return formatter.format(-Math.round(hours / 24), 'day');
}

function validRunUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

function translatedReason(reason, copy) {
  if (!reason) return null;
  return copy.reasons[reason] || statusLabel(reason);
}

function deriveIncident(snapshot, copy) {
  const workflow = snapshot?.workflow || {};
  const runtime = snapshot?.runtime || {};
  const cycle = snapshot?.cycle || {};
  const phases = snapshot?.phases || [];
  const reason = cycle.executionReason;
  const executionPhase = phases.find((phase) => phase.name === 'execution');
  const abnormalPhase = phases.find((phase) => INCIDENT_PHASE_STATUSES.has(phase.status));
  const unsafeRuntime = runtime.liveTradingEnabled || !SAFE_RUNTIME_MODES.has(runtime.mode);

  if (unsafeRuntime) return { severity: 'critical', key: 'unsafeRuntime', ...copy.incidents.unsafeRuntime };
  if (cycle.partialFillDetected || cycle.executionStatus === 'partial_fill') {
    return { severity: 'critical', key: 'partialFill', ...copy.incidents.partialFill };
  }
  if (reason === 'paper_broker_rejected' || cycle.executionStatus === 'failure' || executionPhase?.status === 'failure') {
    return { severity: 'critical', key: 'executionFailure', ...copy.incidents.executionFailure };
  }
  if (snapshot?.error || workflow.conclusion === 'failure' || workflow.status === 'failure' || cycle.status === 'failure') {
    return {
      severity: 'critical',
      key: 'workflowFailure',
      ...copy.incidents.workflowFailure,
      detail: snapshot?.error?.message || copy.incidents.workflowFailure.detail,
    };
  }
  if (workflow.conclusion === 'cancelled' || workflow.status === 'cancelled' || cycle.status === 'cancelled') {
    return { severity: 'warning', key: 'cancelled', ...copy.incidents.cancelled };
  }
  if (snapshot?.freshness?.isStale) return { severity: 'warning', key: 'stale', ...copy.incidents.stale };
  if (reason === 'risk_rejected') return { severity: 'normal', key: 'riskRejected', ...copy.incidents.riskRejected };
  if (reason === 'no_preselected_backtest_symbols') {
    return { severity: 'normal', key: 'noCandidate', ...copy.incidents.noCandidate };
  }
  if (abnormalPhase) return { severity: 'warning', key: 'phaseWarning', ...copy.incidents.phaseWarning };
  if (reason === 'paper_order_submitted' || cycle.executionStatus === 'submitted') {
    return { severity: 'normal', key: 'submitted', ...copy.incidents.submitted };
  }
  if (workflow.conclusion === 'success' || workflow.conclusion === 'completed' || cycle.status === 'success') {
    return { severity: 'normal', key: 'healthy', ...copy.incidents.healthy };
  }
  return { severity: 'info', key: 'unknown', ...copy.incidents.unknown };
}

function severityLabel(severity, copy) {
  if (severity === 'critical') return copy.severityCritical;
  if (severity === 'warning') return copy.severityWarning;
  if (severity === 'normal') return copy.severityNormal;
  return copy.severityInfo;
}

function StatusValue({ label, status }) {
  return (
    <div className="automation-stat">
      <span>{label}</span>
      <strong className={`automation-status status-${status || 'unknown'}`}>
        <StatusIcon status={status} /> {statusLabel(status)}
      </strong>
    </div>
  );
}

function IncidentSummary({ incident, copy }) {
  const role = incident.severity === 'critical' || incident.severity === 'warning' ? 'alert' : 'status';
  return (
    <div
      className={`incident-summary incident-${incident.severity}`}
      role={role}
      aria-live={incident.severity === 'critical' ? 'assertive' : 'polite'}
      data-testid="system-incident-summary"
      data-severity={incident.severity}
    >
      <IncidentIcon severity={incident.severity} />
      <div className="incident-copy">
        <div className="incident-title-row">
          <span className="incident-severity">{severityLabel(incident.severity, copy)}</span>
          <strong>{incident.title}</strong>
        </div>
        <p>{incident.detail}</p>
        <p className="incident-action"><b>{copy.nextAction}:</b> {incident.action}</p>
      </div>
    </div>
  );
}

export default function HourlyAutomationStatus({
  snapshot,
  language = 'th',
  isLoading,
  isRefreshing,
  onRefresh,
  showRefreshAction = true,
}) {
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const copy = COPY[language] || COPY.en;
  if (isLoading && !snapshot?.generatedAt) {
    return (
      <section className="panel automation-panel automation-skeleton" aria-busy="true" aria-label={copy.loading}>
        <div className="skeleton-line skeleton-title" />
        <div className="automation-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div>
      </section>
    );
  }

  const workflow = snapshot?.workflow || {};
  const runtime = snapshot?.runtime || {};
  const cycle = snapshot?.cycle || {};
  const freshness = snapshot?.freshness || {};
  const summary = snapshot?.summary || {};
  const privacy = snapshot?.privacy || {};
  const phases = snapshot?.phases || [];
  const incident = deriveIncident(snapshot, copy);
  const incidentPhaseCount = phases.filter((phase) => INCIDENT_PHASE_STATUSES.has(phase.status)).length;
  const runUrl = validRunUrl(workflow.runUrl);
  const trigger = workflow.eventName === 'schedule' ? copy.scheduled : copy.manual;
  const generatedAt = snapshot?.generatedAt;
  const readableReason = translatedReason(cycle.executionReason, copy);

  return (
    <section className="panel automation-panel" aria-labelledby="hourly-automation-title" data-testid="hourly-automation-status">
      <div className="section-heading automation-heading">
        <div>
          <p className="eyebrow">GitHub Actions snapshot</p>
          <h2 id="hourly-automation-title">{copy.title}</h2>
        </div>
        <div className="automation-actions">
          <span className="status good"><ShieldCheck aria-hidden="true" /> {copy.safe}</span>
          {showRefreshAction ? (
            <button className="icon-action" type="button" onClick={() => onRefresh?.()} disabled={isRefreshing} aria-label={copy.refresh}>
              <RefreshCw className={isRefreshing ? 'spinning' : ''} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <IncidentSummary incident={incident} copy={copy} />

      <div className="automation-grid">
        <div className="automation-stat">
          <span>{copy.latestRun}</span>
          <strong>{formatAbsolute(generatedAt, language)}</strong>
          <small>{formatRelative(generatedAt, language, copy)} · {copy.absolute}</small>
        </div>
        <div className="automation-stat"><span>{copy.trigger}</span><strong>{trigger}</strong><small>{copy.runNumber} #{workflow.runNumber ?? '—'}</small></div>
        <div className="automation-stat"><span>{copy.runtime}</span><strong>{runtime.mode || 'UNKNOWN'}</strong><small>{runtime.brokerMode || 'UNKNOWN'}</small></div>
        <StatusValue label={copy.workflow} status={workflow.conclusion} />
        <StatusValue label={copy.cycle} status={cycle.status} />
        <div className="automation-stat">
          <span>{copy.execution}</span>
          <strong>{cycle.executionAttempted ? copy.attempted : copy.notAttempted}</strong>
          <small>{statusLabel(cycle.executionStatus)}</small>
        </div>
        <div className="automation-stat"><span>{copy.candidates}</span><strong>{summary.candidateCount ?? cycle.candidateCount ?? 0}</strong><small>{copy.positions}: {summary.positionCount ?? 0}</small></div>
        <div className="automation-stat"><span>{copy.orders}</span><strong>{summary.openOrderCount ?? 0}</strong><small>{cycle.partialFillDetected ? copy.partialFill : '—'}</small></div>
        <div className="automation-stat"><span>{copy.snapshotAge}</span><strong>{freshness.ageMinutes == null ? '—' : Math.round(freshness.ageMinutes)}</strong><small>{copy.minutes}</small></div>
      </div>

      {cycle.executionReason ? (
        <div className="automation-reason" data-testid="execution-reason">
          <p><strong>{copy.reason}:</strong> {readableReason}</p>
          <p><strong>{copy.rawCode}:</strong> <code>{cycle.executionReason}</code></p>
        </div>
      ) : null}

      <div className="automation-meta-row">
        <span><strong>{copy.lastSuccess}:</strong> {formatAbsolute(snapshot?.lastSuccessfulRun?.generatedAt, language)}</span>
        {privacy.valuesMasked ? <span className="masked-indicator"><ShieldCheck aria-hidden="true" /> {copy.masked}</span> : null}
        {runUrl ? <a className="run-link" href={runUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> {copy.openRun}</a> : null}
      </div>

      <div className="phase-section">
        <div className="phase-section-heading">
          <div>
            <h3>{copy.phases}</h3>
            {!timelineExpanded && incidentPhaseCount === 0 ? <p className="mobile-phase-note">{copy.noIncidentPhases}</p> : null}
          </div>
          {phases.length ? (
            <button
              className="phase-toggle"
              type="button"
              aria-expanded={timelineExpanded}
              aria-controls="hourly-phase-timeline"
              onClick={() => setTimelineExpanded((current) => !current)}
            >
              {timelineExpanded ? copy.showIncidentPhases : copy.showAllPhases(phases.length)}
              {timelineExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </button>
          ) : null}
        </div>

        {phases.length ? (
          <ol id="hourly-phase-timeline" className={`phase-timeline${timelineExpanded ? ' expanded' : ''}`}>
            {phases.map((item, index) => {
              const labels = PHASE_LABELS[item.name] || [item.name, item.name];
              const incidentPhase = INCIDENT_PHASE_STATUSES.has(item.status);
              return (
                <li
                  key={`${item.name}-${index}`}
                  className={`phase-item status-${item.status} ${incidentPhase ? 'phase-primary' : 'phase-secondary'}`}
                  data-phase-status={item.status}
                >
                  <StatusIcon status={item.status} />
                  <div><strong>{labels[language === 'th' ? 0 : 1]}</strong><span>{statusLabel(item.status)}{item.message ? ` · ${item.message}` : ''}</span></div>
                </li>
              );
            })}
          </ol>
        ) : <p className="hint">{copy.noData}</p>}
      </div>
    </section>
  );
}
