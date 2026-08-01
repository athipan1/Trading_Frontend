export const SYSTEM_COPY = {
  th: {
    title: 'สถานะระบบเทรดรายชั่วโมง', latestRun: 'รอบล่าสุด', runNumber: 'Run', trigger: 'รูปแบบการรัน', runtime: 'โหมดระบบ', workflow: 'Workflow', cycle: 'รอบการทำงาน', execution: 'การส่งคำสั่ง', attempted: 'มีการพยายามส่งคำสั่ง', notAttempted: 'ไม่ได้ส่งคำสั่ง', reason: 'เหตุผล', rawCode: 'รหัสระบบ', nextAction: 'สิ่งที่ควรทำต่อ', candidates: 'Candidate', positions: 'Position', orders: 'Open order', lastSuccess: 'รอบสำเร็จล่าสุด', snapshotAge: 'อายุ Snapshot', minutes: 'นาที', masked: 'ข้อมูลการเงินถูกปกปิด', openRun: 'เปิด GitHub Actions run', phases: 'ลำดับการทำงาน', refresh: 'รีเฟรชตอนนี้', scheduled: 'ตามเวลา', manual: 'สั่งรันเอง', noData: 'ยังไม่มีข้อมูลรอบการทำงาน', loading: 'กำลังโหลดสถานะรายชั่วโมง', partialFill: 'พบ Partial fill', absolute: 'เวลาไทย', relativeNow: 'เมื่อสักครู่', safe: 'Paper-only', severityCritical: 'วิกฤต', severityWarning: 'ต้องตรวจสอบ', severityNormal: 'ปกติ', severityInfo: 'ข้อมูล', showAllPhases: (count) => `ดูทั้ง ${count} ขั้น`, showIncidentPhases: 'แสดงเฉพาะขั้นที่ต้องตรวจสอบ', noIncidentPhases: 'ไม่มีขั้นที่ล้มเหลวหรือมีคำเตือนในรอบนี้',
    incidents: {
      unsafeRuntime: ['Runtime ไม่อยู่ในขอบเขตที่ปลอดภัย', 'Dashboard ตรวจพบโหมดที่ไม่ใช่ Paper หรือ Simulator หรือพบ liveTradingEnabled=true', 'หยุดการเปิดใช้งาน Production และตรวจค่า Runtime กับ Manager_Agent ก่อนรอบถัดไป'],
      partialFill: ['พบคำสั่งซื้อขายที่ Fill ไม่ครบ', 'สถานะ Position และ Order อาจไม่ตรงกับแผนเดิมจนกว่าจะ Reconcile สำเร็จ', 'ตรวจ Alpaca Paper, Position, Open Order และ Final Reconciliation ทันที'],
      executionFailure: ['การส่งคำสั่ง Paper Trading ล้มเหลว', 'Execution phase หรือ Paper broker ปฏิเสธคำสั่งในรอบล่าสุด', 'เปิด GitHub Actions run ตรวจ Broker response แล้วตรวจว่าไม่มี Order ค้างหรือ Position บางส่วน'],
      workflowFailure: ['Workflow รายชั่วโมงทำงานไม่สำเร็จ', 'รอบล่าสุดสิ้นสุดด้วย Failure และอาจยังไม่ผ่าน Final Reconciliation', 'เปิด GitHub Actions run ตรวจขั้นแรกที่ล้มเหลว และยืนยันสถานะพอร์ตกับโบรกเกอร์'],
      cancelled: ['Workflow ถูกยกเลิกก่อนจบรอบ', 'บางขั้นอาจยังไม่ได้ทำงาน รวมถึงการตรวจสอบหลังส่งคำสั่ง', 'ตรวจเหตุผลการยกเลิก แล้วรันรอบใหม่เมื่อยืนยันว่าไม่มีคำสั่งค้าง'],
      stale: ['Snapshot เก่าเกินกำหนด', 'ข้อมูลบน Dashboard อาจไม่สะท้อนรอบล่าสุดของ Manager_Agent', 'ตรวจ Workflow publisher และ GitHub Actions ก่อนใช้ข้อมูลตัดสินใจ'],
      phaseWarning: ['มีขั้นตอนที่ต้องตรวจสอบ', 'Workflow จบได้ แต่มี Phase ที่รายงาน Warning หรือ Failure ภายในรอบ', 'เปิด Timeline ดู Phase ที่ผิดปกติและตรวจข้อความจาก Agent ที่เกี่ยวข้อง'],
      riskRejected: ['Risk Agent ไม่อนุมัติคำสั่ง', 'ระบบป้องกันความเสี่ยงทำงานตามขอบเขต และไม่มีคำสั่งถูกส่งไปยังโบรกเกอร์', 'ไม่ต้องดำเนินการทันที ตรวจ Risk reason เฉพาะเมื่อผลลัพธ์ไม่ตรงกับนโยบายที่ตั้งไว้'],
      noCandidate: ['ไม่มีหุ้นผ่านเงื่อนไขในรอบนี้', 'Scanner หรือ Backtest ไม่พบ Candidate ที่ผ่านเกณฑ์ จึงไม่มีการส่งคำสั่ง', 'รอรอบตามเวลาถัดไป ไม่ควรลดเกณฑ์เพียงเพื่อบังคับให้ระบบเทรด'],
      submitted: ['ส่งคำสั่ง Paper Trading แล้ว', 'คำสั่งผ่าน Risk และถูกส่งเข้าสู่ Paper broker ในรอบล่าสุด', 'ตรวจ Final Reconciliation และยืนยันว่า Position มี Stop Loss และ Take Profit ครบ'],
      healthy: ['ระบบทำงานปกติ', 'ไม่พบเหตุการณ์วิกฤต คำเตือน หรือข้อมูลเก่าใน Snapshot ล่าสุด', 'ไม่ต้องดำเนินการ ตรวจรอบถัดไปตามตารางปกติ'],
      unknown: ['ยังสรุปสถานะไม่ได้', 'Snapshot มีข้อมูลไม่เพียงพอสำหรับจัดประเภทเหตุการณ์', 'ตรวจ Schema, Runtime และ GitHub Actions run ล่าสุด'],
    },
    reasons: { risk_rejected: 'Risk Agent ไม่อนุมัติคำสั่ง', paper_broker_rejected: 'Alpaca Paper ปฏิเสธคำสั่ง', no_preselected_backtest_symbols: 'ไม่มีหุ้นผ่านเงื่อนไข Scanner และ Backtest', paper_order_submitted: 'ส่งคำสั่งไปยัง Alpaca Paper แล้ว', partial_fill: 'คำสั่งถูก Fill เพียงบางส่วน' },
  },
  en: {
    title: 'Hourly Automation Status', latestRun: 'Latest run', runNumber: 'Run', trigger: 'Trigger', runtime: 'Runtime', workflow: 'Workflow', cycle: 'Cycle', execution: 'Execution', attempted: 'Execution attempted', notAttempted: 'Not attempted', reason: 'Reason', rawCode: 'Raw code', nextAction: 'Recommended next action', candidates: 'Candidates', positions: 'Positions', orders: 'Open orders', lastSuccess: 'Last successful run', snapshotAge: 'Snapshot age', minutes: 'minutes', masked: 'Financial values are masked', openRun: 'Open GitHub Actions run', phases: 'Execution phases', refresh: 'Refresh now', scheduled: 'Scheduled', manual: 'Manual', noData: 'No hourly run data is available yet', loading: 'Loading hourly automation status', partialFill: 'Partial fill detected', absolute: 'Bangkok time', relativeNow: 'just now', safe: 'Paper-only', severityCritical: 'Critical', severityWarning: 'Needs review', severityNormal: 'Normal', severityInfo: 'Information', showAllPhases: (count) => `Show all ${count} phases`, showIncidentPhases: 'Show incident phases only', noIncidentPhases: 'No failed or warning phases were reported in this run.',
    incidents: {
      unsafeRuntime: ['Runtime is outside the safe boundary', 'The dashboard detected a non-paper, non-simulator mode or liveTradingEnabled=true.', 'Stop the production rollout and verify Manager_Agent runtime configuration before the next cycle.'],
      partialFill: ['A partially filled order was detected', 'Positions and orders may differ from the original plan until reconciliation completes.', 'Inspect Alpaca Paper, positions, open orders, and final reconciliation immediately.'],
      executionFailure: ['Paper-trading execution failed', 'The execution phase failed or the paper broker rejected the latest order.', 'Open the GitHub Actions run, inspect the broker response, and verify that no order or partial position remains.'],
      workflowFailure: ['The hourly workflow failed', 'The latest run ended in failure and may not have completed final reconciliation.', 'Inspect the first failed phase and verify the portfolio directly against the broker state.'],
      cancelled: ['The workflow was cancelled before completion', 'Some phases may not have run, including post-execution reconciliation.', 'Confirm why the run was cancelled, then rerun only after checking for outstanding orders.'],
      stale: ['The dashboard snapshot is stale', 'The displayed data may not reflect the latest Manager_Agent cycle.', 'Check the snapshot publisher and GitHub Actions before using this data for a decision.'],
      phaseWarning: ['One or more phases need review', 'The workflow completed, but an internal phase reported a warning or failure.', 'Open the timeline, inspect the abnormal phase, and review the related agent message.'],
      riskRejected: ['Risk Agent rejected the trade', 'The safety gate operated as designed and no order was sent to the broker.', 'No immediate action is required. Review the risk reason only when it conflicts with policy.'],
      noCandidate: ['No symbol passed this cycle', 'Scanner or backtest criteria produced no approved candidate, so execution was skipped.', 'Wait for the next scheduled cycle. Do not weaken controls merely to force a trade.'],
      submitted: ['A paper-trading order was submitted', 'The order passed Risk and was submitted to the paper broker in the latest cycle.', 'Verify final reconciliation and confirm that Stop Loss and Take Profit protection are present.'],
      healthy: ['System operating normally', 'No critical incident, warning, or stale-data condition was found in the latest snapshot.', 'No operator action is required. Continue with the normal schedule.'],
      unknown: ['System status cannot be classified yet', 'The snapshot does not contain enough information to classify the latest cycle.', 'Verify the schema, runtime, and latest GitHub Actions run.'],
    },
    reasons: { risk_rejected: 'Risk Agent rejected the trade', paper_broker_rejected: 'Alpaca Paper rejected the order', no_preselected_backtest_symbols: 'No symbol passed scanner and backtest criteria', paper_order_submitted: 'The order was submitted to Alpaca Paper', partial_fill: 'The order was only partially filled' },
  },
};

export const PHASE_LABELS = {
  preflight: ['Preflight', 'Preflight'], portfolio_review: ['ตรวจพอร์ต', 'Portfolio Review'], protection_reconciliation: ['ตรวจ TP/SL', 'Protection Reconciliation'], scanner: ['Scanner', 'Scanner'], backtest: ['Backtest', 'Backtest'], risk: ['Risk', 'Risk'], execution: ['Execution', 'Execution'], final_reconciliation: ['ตรวจสอบหลังรัน', 'Final Reconciliation'],
};

export const INCIDENT_PHASE_STATUSES = new Set(['failure', 'warning', 'cancelled']);
const SAFE_RUNTIME_MODES = new Set(['ALPACA_PAPER', 'PAPER', 'PAPER_TRADING', 'SIMULATOR', 'DRY_RUN']);

export function statusLabel(status) {
  return String(status || 'unknown').replaceAll('_', ' ');
}

function incident(copy, severity, key, detailOverride) {
  const [title, detail, action] = copy.incidents[key];
  return { severity, key, title, detail: detailOverride || detail, action };
}

export function deriveSystemIncident(snapshot, copy) {
  const workflow = snapshot?.workflow || {};
  const runtime = snapshot?.runtime || {};
  const cycle = snapshot?.cycle || {};
  const phases = snapshot?.phases || [];
  const reason = cycle.executionReason;
  const runtimeMode = String(runtime.mode || 'UNKNOWN').toUpperCase();
  const explicitUnsafeRuntime = runtime.liveTradingEnabled || (runtimeMode !== 'UNKNOWN' && !SAFE_RUNTIME_MODES.has(runtimeMode));
  const executionPhase = phases.find((phase) => phase.name === 'execution');
  const abnormalPhase = phases.find((phase) => INCIDENT_PHASE_STATUSES.has(phase.status));
  const cancelled = workflow.conclusion === 'cancelled' || workflow.status === 'cancelled' || cycle.status === 'cancelled';

  if (explicitUnsafeRuntime) return incident(copy, 'critical', 'unsafeRuntime');
  if (cycle.partialFillDetected || cycle.executionStatus === 'partial_fill') return incident(copy, 'critical', 'partialFill');
  if (reason === 'paper_broker_rejected' || cycle.executionStatus === 'failure' || executionPhase?.status === 'failure') return incident(copy, 'critical', 'executionFailure');
  if (cancelled) return incident(copy, 'warning', 'cancelled', snapshot?.error?.message);
  if (snapshot?.error || workflow.conclusion === 'failure' || workflow.status === 'failure' || cycle.status === 'failure') return incident(copy, 'critical', 'workflowFailure', snapshot?.error?.message);
  if (snapshot?.freshness?.isStale) return incident(copy, 'warning', 'stale');
  if (reason === 'risk_rejected') return incident(copy, 'normal', 'riskRejected');
  if (reason === 'no_preselected_backtest_symbols') return incident(copy, 'normal', 'noCandidate');
  if (abnormalPhase) return incident(copy, 'warning', 'phaseWarning');
  if (reason === 'paper_order_submitted' || cycle.executionStatus === 'submitted') return incident(copy, 'normal', 'submitted');
  if (workflow.conclusion === 'success' || workflow.conclusion === 'completed' || cycle.status === 'success') return incident(copy, 'normal', 'healthy');
  return incident(copy, 'info', 'unknown');
}

export function translatedReason(reason, copy) {
  if (!reason) return null;
  return copy.reasons[reason] || statusLabel(reason);
}

export function severityLabel(severity, copy) {
  if (severity === 'critical') return copy.severityCritical;
  if (severity === 'warning') return copy.severityWarning;
  if (severity === 'normal') return copy.severityNormal;
  return copy.severityInfo;
}
