const COPY = Object.freeze({
  no_preselected_backtest_symbols: {
    th: { title: 'ยังไม่มีหุ้นที่ผ่านถึง Backtest', explanation: 'ไม่มี Symbol ผ่านการคัดกรองเบื้องต้น จึงยังไม่เริ่ม Backtest', action: 'ตรวจ Scanner และเกณฑ์ investability' },
    en: { title: 'No symbol reached Backtest', explanation: 'No symbol passed initial screening, so Backtest did not start.', action: 'Review Scanner and investability rules.' },
  },
  scheduled_paper_cycle_not_authorized: {
    th: { title: 'รอบ Paper Trading ถูก safety gate หยุด', explanation: 'เงื่อนไขความปลอดภัยยังไม่อนุญาตให้รอบตามเวลาดำเนินต่อ', action: 'ตรวจ safety gate และ scheduled Paper Trading' },
    en: { title: 'Scheduled Paper Trading was blocked', explanation: 'Safety conditions did not authorize this scheduled cycle.', action: 'Review the safety gate and schedule configuration.' },
  },
  hourly_schedule_disabled: {
    th: { title: 'รอบเทรดรายชั่วโมงถูกปิดไว้', explanation: 'รอบนี้เป็น control cycle และไม่ได้ตัดสินใจเทรด เพราะ hourly schedule ปิดอยู่', action: 'ไม่ต้องทำอะไร หากตั้งใจปิด schedule' },
    en: { title: 'Hourly trading is disabled', explanation: 'This control cycle did not trade because the hourly schedule is disabled.', action: 'No action is needed if this is intentional.' },
  },
  hourly_artifact_unavailable: {
    th: { title: 'ยังไม่มีหลักฐานการตัดสินใจล่าสุด', explanation: 'Manager มี workflow metadata แต่ไม่พบ hourly trading artifact ของรอบนี้', action: 'ตรวจ workflow artifact หรือขั้น publish snapshot' },
    en: { title: 'Latest decision evidence is unavailable', explanation: 'Manager has workflow metadata but no hourly trading artifact for this cycle.', action: 'Check the workflow artifact or snapshot publishing step.' },
  },
  market_closed: {
    th: { title: 'ตลาดปิด จึงยังไม่เปิดสถานะใหม่', explanation: 'ระบบหยุดก่อนส่งคำสั่ง เพราะอยู่นอกช่วงที่อนุญาตให้เปิด Position', action: 'รอรอบตลาดเปิดและดูการตัดสินใจถัดไป' },
    en: { title: 'Market closed; no new position opened', explanation: 'The system stopped before order submission because new entries are not allowed now.', action: 'Wait for a market-open cycle.' },
  },
  no_eligible_strategy: {
    th: { title: 'Backtest ยังไม่พบกลยุทธ์ที่ผ่าน', explanation: 'Candidate ไม่มี Strategy ที่ผ่านเกณฑ์ย้อนหลัง จึงไม่ไปขั้นเปิด Position', action: 'ตรวจ Backtest และ metric ที่ไม่ผ่าน' },
    en: { title: 'Backtest found no eligible strategy', explanation: 'No strategy passed the backtest criteria, so the candidate did not advance.', action: 'Review Backtest results and failed metrics.' },
  },
  investability_market_cap_below_minimum: {
    th: { title: 'บริษัทเล็กกว่าที่นโยบายอนุญาต', explanation: 'Market cap ต่ำกว่าเกณฑ์ investability จึงถูกคัดออก', action: 'ตรวจ market-cap threshold' },
    en: { title: 'Company size is below policy', explanation: 'Market cap is below the investability minimum, so the candidate was filtered.', action: 'Review the market-cap threshold.' },
  },
  investability_average_dollar_volume_below_minimum: {
    th: { title: 'สภาพคล่องของหุ้นต่ำกว่าเกณฑ์', explanation: 'Average dollar volume ต่ำกว่าขั้นต่ำ จึงเสี่ยงด้านสภาพคล่องเกินนโยบาย', action: 'ตรวจเกณฑ์และข้อมูลสภาพคล่องของ Symbol' },
    en: { title: 'Trading liquidity is below the minimum', explanation: 'Average dollar volume is below the threshold, so liquidity risk exceeds policy.', action: 'Review the threshold and liquidity evidence.' },
  },
  investability_spread_missing: {
    th: { title: 'ข้อมูล Bid/Ask spread ยังไม่ครบ', explanation: 'หลักฐาน spread ไม่พอสำหรับยืนยันต้นทุนและสภาพคล่องอย่างปลอดภัย', action: 'ตรวจ market data และรอ snapshot ที่ครบ' },
    en: { title: 'Bid/ask spread evidence is incomplete', explanation: 'Spread evidence is insufficient to validate entry cost and liquidity safely.', action: 'Check market data and wait for complete spread evidence.' },
  },
  evidence_gate_failed: {
    th: { title: 'หลักฐานที่ใช้ตัดสินใจยังไม่พอ', explanation: 'ข้อมูลที่ Manager ต้องการยังไม่ครบ ระบบจึงหยุดแบบ fail-closed', action: 'เปิดรายละเอียดเพื่อดู reason code และขั้นที่ขาดหลักฐาน' },
    en: { title: 'Decision evidence is insufficient', explanation: 'Required Manager evidence is incomplete, so the candidate stopped fail-closed.', action: 'Open technical details for the missing evidence.' },
  },
  new_entry_not_allowed: {
    th: { title: 'นโยบายไม่อนุญาตให้เปิด Position ใหม่', explanation: 'แม้มีสัญญาณ แต่ policy ปัจจุบันไม่ให้เพิ่ม Position ในรอบนี้', action: 'ตรวจ Market Regime, Portfolio policy และ Risk state' },
    en: { title: 'Policy does not allow a new position', explanation: 'The candidate may have a signal, but current policy blocks a new position.', action: 'Review Market Regime, Portfolio policy, and Risk state.' },
  },
  bucket_unassigned: {
    th: { title: 'ยังจัด Strategy bucket ไม่ได้', explanation: 'หลักฐานยังไม่พอสำหรับจัด Candidate ลง bucket ที่อนุญาต', action: 'ตรวจ strategy classification evidence' },
    en: { title: 'No strategy bucket could be assigned', explanation: 'Evidence is insufficient to assign an allowed strategy bucket.', action: 'Review strategy classification evidence.' },
  },
  bucket_conflict: {
    th: { title: 'ข้อมูลกลยุทธ์ขัดแย้งกัน', explanation: 'หลักฐานที่ใช้จัด Strategy bucket ให้ผลไม่ตรงกัน ระบบจึงหยุดแทนการเดา', action: 'ตรวจ source ของ strategy evidence' },
    en: { title: 'Strategy evidence conflicts', explanation: 'Strategy classification evidence disagrees, so the system stopped instead of guessing.', action: 'Review the conflicting evidence sources.' },
  },
  bucket_evidence_insufficient: {
    th: { title: 'ข้อมูลเลือกกลยุทธ์ยังไม่พอ', explanation: 'Candidate ยังไม่มี evidence ครบสำหรับเลือก Strategy bucket อย่างปลอดภัย', action: 'ตรวจข้อมูลที่ขาดก่อนให้ไปขั้นต่อไป' },
    en: { title: 'Strategy evidence is insufficient', explanation: 'The candidate lacks enough evidence for a safe strategy-bucket decision.', action: 'Review missing evidence before advancing.' },
  },
  manager_verdict_hold: {
    th: { title: 'Manager เลือก HOLD', explanation: 'หลักฐานรอบนี้ยังไม่พอให้เปิดหรือเพิ่ม Position จึงไม่มีคำสั่งซื้อใหม่', action: 'ติดตามรอบถัดไปว่าหลักฐานหรือคะแนนเปลี่ยนหรือไม่' },
    en: { title: 'Manager chose HOLD', explanation: 'Current evidence does not justify opening or adding to a position.', action: 'Watch the next cycle for evidence or score changes.' },
  },
  manager_verdict_sell: {
    th: { title: 'Manager ให้สัญญาณ SELL', explanation: 'Candidate ถูกประเมินฝั่งขาย ไม่ใช่การเปิด Position ซื้อใหม่', action: 'ตรวจ Position lifecycle และ Risk approval' },
    en: { title: 'Manager produced a SELL verdict', explanation: 'The candidate was evaluated on the sell side, not as a new long entry.', action: 'Check position lifecycle and Risk approval.' },
  },
  risk_rejected: {
    th: { title: 'Risk ไม่อนุมัติรายการนี้', explanation: 'Candidate ถึง Risk gate แต่ไม่ผ่านนโยบายความเสี่ยง จึงหยุดก่อนส่งคำสั่งไป Execution หรือ Broker', action: 'เปิดรายละเอียดเพื่อดู reason code/evidence; อย่าข้าม Risk gate' },
    en: { title: 'Risk did not approve this candidate', explanation: 'The candidate failed active risk policy and stopped before Execution or broker submission.', action: 'Open technical details; do not bypass the Risk gate.' },
  },
  execution_failed: {
    th: { title: 'ขั้นส่งคำสั่งล้มเหลวอย่างปลอดภัย', explanation: 'Candidate ถึง Execution แต่ส่งคำสั่งไม่สำเร็จ จึงไม่ถือว่า Execute แล้ว', action: 'ตรวจ Execution status, broker response และ reconciliation' },
    en: { title: 'Order execution failed safely', explanation: 'Order submission did not complete, so the system does not treat it as executed.', action: 'Review Execution status, broker response, and reconciliation.' },
  },
  protection_gap_detected: {
    th: { title: 'พบ Position ที่การป้องกันยังไม่ครบ', explanation: 'พบ protective-order coverage ที่ขาดหรือยังยืนยันไม่ได้ เช่น stop', action: 'ตรวจ Position และ protective orders โดยเร็ว' },
    en: { title: 'A position-protection gap was detected', explanation: 'Protective-order coverage is missing or unconfirmed, such as an expected stop.', action: 'Review the position and protective orders promptly.' },
  },
});

const STAGE_FALLBACK = Object.freeze({
  scanner: ['Candidate หยุดที่ Scanner', 'Candidate stopped at Scanner'],
  backtest: ['Candidate หยุดที่ Backtest', 'Candidate stopped at Backtest'],
  market_regime: ['Candidate หยุดที่สภาวะตลาด', 'Candidate stopped at Market Regime'],
  portfolio: ['Candidate หยุดที่พอร์ต', 'Candidate stopped at Portfolio'],
  profit: ['Candidate หยุดที่ Profit policy', 'Candidate stopped at Profit policy'],
  risk: ['Candidate หยุดที่ Risk gate', 'Candidate stopped at the Risk gate'],
  execution: ['Candidate หยุดที่ Execution', 'Candidate stopped at Execution'],
});

function locale(language) {
  return language === 'en' ? 'en' : 'th';
}

export function explainDecisionReason(code, { language = 'th', stage = null } = {}) {
  const lang = locale(language);
  const known = COPY[code]?.[lang];
  if (known) return { ...known, code, known: true };

  const stageLabel = STAGE_FALLBACK[stage]?.[lang === 'th' ? 0 : 1];
  return {
    code: code || 'unknown',
    known: false,
    title: stageLabel || (lang === 'th' ? 'ยังไม่มีคำอธิบายสำหรับเหตุผลนี้' : 'This reason has no plain-language explanation yet'),
    explanation: lang === 'th'
      ? 'Frontend จะไม่เดาเหตุผลจากข้อมูลที่ไม่มี เพื่อยึดหลักฐานจาก Manager_Agent เท่านั้น'
      : 'The Frontend will not guess missing rationale; it stays limited to Manager_Agent evidence.',
    action: lang === 'th'
      ? 'เปิดรายละเอียดและตรวจ reason code นี้ใน Manager_Agent'
      : 'Open technical details and inspect this reason code in Manager_Agent.',
  };
}

export function explainDecisionReasons(codes, options = {}) {
  const uniqueCodes = [...new Set((Array.isArray(codes) ? codes : []).filter(Boolean))];
  return uniqueCodes.map((code) => explainDecisionReason(code, options));
}
