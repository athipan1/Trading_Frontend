const COPY = Object.freeze({
  no_preselected_backtest_symbols: {
    th: {
      title: 'ยังไม่มีหุ้นที่ผ่านไปถึงขั้น Backtest',
      explanation: 'รอบนี้ไม่มี Symbol ผ่านเงื่อนไขคัดกรองเบื้องต้น จึงยังไม่เริ่มการทดสอบกลยุทธ์ย้อนหลัง',
      action: 'ตรวจผล Scanner และเกณฑ์ investability ของ Candidate ที่ถูกคัดออก',
    },
    en: {
      title: 'No symbol reached Backtest',
      explanation: 'No symbol passed the initial screening rules in this cycle, so strategy backtesting did not start.',
      action: 'Review Scanner results and investability rules for the filtered candidates.',
    },
  },
  scheduled_paper_cycle_not_authorized: {
    th: {
      title: 'รอบ Paper Trading ถูก safety gate หยุดไว้',
      explanation: 'ระบบไม่อนุญาตให้รอบตามเวลานี้ดำเนินการต่อ เพราะเงื่อนไขความปลอดภัยสำหรับ scheduled Paper Trading ยังไม่อนุมัติ',
      action: 'ตรวจสถานะ safety gate และการตั้งค่า scheduled Paper Trading ใน Manager_Agent',
    },
    en: {
      title: 'Scheduled Paper Trading was stopped by a safety gate',
      explanation: 'This scheduled cycle was not allowed to continue because the Paper Trading safety conditions were not authorized.',
      action: 'Review the Manager_Agent safety gate and scheduled Paper Trading configuration.',
    },
  },
  hourly_schedule_disabled: {
    th: {
      title: 'รอบเทรดรายชั่วโมงถูกปิดไว้โดยตั้งใจ',
      explanation: 'ระบบบันทึกรอบนี้เป็น control cycle และไม่ได้พยายามตัดสินใจเทรด เพราะ hourly schedule ถูกปิดอยู่',
      action: 'ไม่ต้องแก้ไข หากการปิด schedule เป็นพฤติกรรมที่ตั้งใจไว้',
    },
    en: {
      title: 'Hourly trading is intentionally disabled',
      explanation: 'This is a control cycle. The system did not attempt a trading decision because the hourly schedule is disabled.',
      action: 'No action is needed if the disabled schedule is intentional.',
    },
  },
  hourly_artifact_unavailable: {
    th: {
      title: 'ยังไม่มีหลักฐานการตัดสินใจของรอบล่าสุด',
      explanation: 'Manager มี metadata ของ workflow แต่ไม่พบ hourly trading artifact ที่ใช้ยืนยันรายละเอียดการตัดสินใจของรอบนี้',
      action: 'ตรวจ workflow artifact หรือขั้นตอน publish snapshot ก่อนสรุปว่ารอบนี้ทำงานปกติ',
    },
    en: {
      title: 'Latest decision evidence is unavailable',
      explanation: 'Manager has workflow metadata, but the hourly trading artifact needed to verify this cycle is missing.',
      action: 'Check the workflow artifact or snapshot publishing step before treating this cycle as healthy.',
    },
  },
  market_closed: {
    th: {
      title: 'ตลาดปิด จึงยังไม่เปิดสถานะใหม่',
      explanation: 'ระบบหยุดก่อนส่งคำสั่งใหม่ เพราะตลาดไม่ได้อยู่ในช่วงที่อนุญาตให้เปิด Position ตามนโยบายปัจจุบัน',
      action: 'รอรอบที่ตลาดเปิด หรือดูรายละเอียดรอบถัดไปแทนการส่งคำสั่งเอง',
    },
    en: {
      title: 'The market is closed, so no new position was opened',
      explanation: 'The system stopped before order submission because the market is outside the current policy window for new entries.',
      action: 'Wait for a market-open cycle and review the next automated decision.',
    },
  },
  no_eligible_strategy: {
    th: {
      title: 'Backtest ยังไม่พบกลยุทธ์ที่ผ่านเกณฑ์',
      explanation: 'Candidate นี้ไม่มี Strategy ที่ผ่านเกณฑ์ย้อนหลังของระบบ จึงไม่ถูกส่งต่อไปเปิด Position',
      action: 'ตรวจผล Backtest และ metric ที่ไม่ผ่านก่อนพิจารณาปรับกลยุทธ์',
    },
    en: {
      title: 'Backtest found no eligible strategy',
      explanation: 'This candidate has no strategy that passed the system backtest criteria, so it was not advanced to a new position.',
      action: 'Review the Backtest results and failed metrics before changing strategy policy.',
    },
  },
  investability_market_cap_below_minimum: {
    th: {
      title: 'บริษัทมีขนาดเล็กกว่าที่นโยบายอนุญาต',
      explanation: 'Market cap ของ Candidate ต่ำกว่าเกณฑ์ investability ที่ Manager กำหนด จึงถูกคัดออกก่อนเข้าสู่ขั้นถัดไป',
      action: 'ตรวจค่า market-cap threshold หากต้องการเข้าใจเกณฑ์ที่ใช้คัดกรอง',
    },
    en: {
      title: 'Company size is below the investability policy',
      explanation: 'The candidate market cap is below the minimum configured by Manager, so it was filtered before advancing.',
      action: 'Review the market-cap threshold to understand the screening boundary.',
    },
  },
  investability_average_dollar_volume_below_minimum: {
    th: {
      title: 'สภาพคล่องของหุ้นต่ำกว่าเกณฑ์',
      explanation: 'มูลค่าการซื้อขายเฉลี่ยเป็นดอลลาร์ต่ำกว่าขั้นต่ำที่ระบบกำหนด จึงมีความเสี่ยงด้านสภาพคล่องมากเกินนโยบาย',
      action: 'ตรวจ average-dollar-volume threshold และข้อมูลสภาพคล่องของ Symbol นี้',
    },
    en: {
      title: 'Trading liquidity is below the minimum',
      explanation: 'Average dollar volume is below the configured threshold, so liquidity risk exceeds the current investability policy.',
      action: 'Review the average-dollar-volume threshold and this symbol liquidity evidence.',
    },
  },
  investability_spread_missing: {
    th: {
      title: 'ข้อมูล Bid/Ask spread ยังไม่ครบ',
      explanation: 'ระบบไม่มีหลักฐาน spread เพียงพอที่จะยืนยันต้นทุนและสภาพคล่องของการเข้า Position อย่างปลอดภัย',
      action: 'ตรวจแหล่งข้อมูลราคาและรอ snapshot ที่มี spread ครบก่อน',
    },
    en: {
      title: 'Bid/ask spread evidence is incomplete',
      explanation: 'The system does not have enough spread evidence to validate entry cost and liquidity safely.',
      action: 'Check the market-data source and wait for a snapshot with complete spread evidence.',
    },
  },
  evidence_gate_failed: {
    th: {
      title: 'หลักฐานที่ใช้ตัดสินใจยังไม่เพียงพอ',
      explanation: 'ข้อมูลหรือผลวิเคราะห์ที่ Manager ต้องการยังไม่ครบตาม evidence gate จึงหยุด Candidate แบบ fail-closed',
      action: 'เปิดรายละเอียดทางเทคนิคเพื่อดู reason code และขั้นที่ขาดหลักฐาน',
    },
    en: {
      title: 'Decision evidence is not sufficient',
      explanation: 'Required Manager evidence is incomplete, so the candidate was stopped fail-closed.',
      action: 'Open technical details to inspect the reason code and the stage missing evidence.',
    },
  },
  new_entry_not_allowed: {
    th: {
      title: 'นโยบายไม่อนุญาตให้เปิด Position ใหม่',
      explanation: 'แม้ Candidate จะมีสัญญาณ แต่ policy ปัจจุบันสั่งไม่ให้เพิ่ม Position ใหม่ในรอบนี้',
      action: 'ตรวจ Market Regime, Portfolio policy และ Risk state ที่ Manager ใช้ประกอบการตัดสินใจ',
    },
    en: {
      title: 'Policy does not allow a new position',
      explanation: 'The candidate may have a signal, but current policy does not permit a new position in this cycle.',
      action: 'Review Market Regime, Portfolio policy, and Risk state used by Manager.',
    },
  },
  bucket_unassigned: {
    th: {
      title: 'ยังจัดกลุ่มกลยุทธ์ให้ Candidate ไม่ได้',
      explanation: 'ระบบยังไม่มีหลักฐานเพียงพอที่จะจัด Candidate ลง Strategy bucket ที่อนุญาต จึงไม่ส่งต่อ',
      action: 'ตรวจข้อมูล strategy classification และ evidence ที่ใช้จัด bucket',
    },
    en: {
      title: 'No strategy bucket could be assigned',
      explanation: 'The system lacks enough evidence to assign this candidate to an allowed strategy bucket, so it did not advance.',
      action: 'Review strategy classification evidence and bucket policy.',
    },
  },
  bucket_conflict: {
    th: {
      title: 'ข้อมูลกลยุทธ์ขัดแย้งกัน',
      explanation: 'หลักฐานที่ใช้จัด Strategy bucket ให้ผลไม่สอดคล้องกัน ระบบจึงหยุดแทนการเดา',
      action: 'ตรวจ source ของ strategy evidence ที่ให้ผลขัดแย้งกัน',
    },
    en: {
      title: 'Strategy evidence conflicts',
      explanation: 'Evidence used for strategy classification disagrees, so the system stopped instead of guessing.',
      action: 'Review the conflicting strategy evidence sources.',
    },
  },
  bucket_evidence_insufficient: {
    th: {
      title: 'ข้อมูลสำหรับเลือกกลยุทธ์ยังไม่พอ',
      explanation: 'Candidate ยังไม่มี evidence ครบสำหรับการเลือก Strategy bucket ที่ปลอดภัย',
      action: 'ตรวจข้อมูลที่ขาดก่อนพิจารณาให้ Candidate ไปขั้นต่อไป',
    },
    en: {
      title: 'Strategy evidence is insufficient',
      explanation: 'The candidate does not have enough evidence for a safe strategy-bucket decision.',
      action: 'Review missing evidence before allowing this candidate to advance.',
    },
  },
  manager_verdict_hold: {
    th: {
      title: 'Manager เลือก HOLD',
      explanation: 'Manager สรุปว่ายังไม่ควรเปิดหรือเพิ่ม Position จากหลักฐานในรอบนี้ จึงไม่มีคำสั่งซื้อใหม่',
      action: 'ติดตามรอบถัดไปและดูว่าหลักฐานหรือคะแนนเปลี่ยนแปลงหรือไม่',
    },
    en: {
      title: 'Manager chose HOLD',
      explanation: 'Manager concluded that the current evidence does not justify opening or adding to a position, so no new buy order was created.',
      action: 'Watch the next cycle for changes in evidence or score.',
    },
  },
  manager_verdict_sell: {
    th: {
      title: 'Manager ให้สัญญาณ SELL',
      explanation: 'Manager ประเมิน Candidate นี้เป็นฝั่งขาย ไม่ใช่การเปิด Position ซื้อใหม่',
      action: 'ตรวจ Position lifecycle และ Risk approval ก่อนตีความว่าเป็นการขายจริง',
    },
    en: {
      title: 'Manager produced a SELL verdict',
      explanation: 'Manager evaluated this candidate on the sell side rather than as a new long entry.',
      action: 'Check the position lifecycle and Risk approval before treating it as an executed sale.',
    },
  },
  risk_rejected: {
    th: {
      title: 'Risk ไม่อนุมัติรายการนี้',
      explanation: 'Candidate มาถึง Risk gate แล้ว แต่ไม่ผ่านนโยบายความเสี่ยง จึงถูกหยุดก่อนส่งคำสั่งไป Execution และ Broker',
      action: 'เปิดรายละเอียดทางเทคนิคเพื่อดู reason code/evidence จาก Manager; อย่าข้าม Risk gate ด้วยการส่งคำสั่งเอง',
    },
    en: {
      title: 'Risk did not approve this candidate',
      explanation: 'The candidate reached the Risk gate but failed the active risk policy, so it stopped before Execution or broker submission.',
      action: 'Open technical details for Manager reason codes/evidence; do not bypass the Risk gate manually.',
    },
  },
  execution_failed: {
    th: {
      title: 'ขั้นส่งคำสั่งล้มเหลวและระบบหยุดแบบปลอดภัย',
      explanation: 'Candidate ผ่านมาถึง Execution แต่ขั้นส่งคำสั่งไม่สำเร็จ ระบบจึงไม่ถือว่ารายการนี้ Execute แล้ว',
      action: 'ตรวจ Execution status, broker response และ reconciliation ก่อนลองใหม่',
    },
    en: {
      title: 'Order execution failed safely',
      explanation: 'The candidate reached Execution, but order submission did not complete. The system therefore does not treat it as executed.',
      action: 'Review Execution status, broker response, and reconciliation before retrying.',
    },
  },
  protection_gap_detected: {
    th: {
      title: 'พบ Position ที่การป้องกันยังไม่ครบ',
      explanation: 'ระบบตรวจพบช่องว่างของ protective orders เช่น stop หรือคำสั่งป้องกันที่คาดว่าจะมี แต่หลักฐานปัจจุบันยังไม่ยืนยันว่าครบ',
      action: 'ตรวจ Position และ protective orders ในระบบต้นทางโดยเร็ว',
    },
    en: {
      title: 'A position-protection gap was detected',
      explanation: 'The system detected missing or unconfirmed protective-order coverage, such as an expected stop or related protection.',
      action: 'Review the position and protective orders in the source system promptly.',
    },
  },
});

const STAGE_FALLBACK = Object.freeze({
  scanner: ['Candidate หยุดที่ Scanner', 'Candidate stopped at Scanner'],
  backtest: ['Candidate หยุดที่ Backtest', 'Candidate stopped at Backtest'],
  market_regime: ['Candidate หยุดที่การประเมินสภาวะตลาด', 'Candidate stopped at Market Regime'],
  portfolio: ['Candidate หยุดที่การตรวจพอร์ต', 'Candidate stopped at Portfolio'],
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
    title: stageLabel || (lang === 'th' ? 'ระบบมีเหตุผลทางเทคนิคที่ยังไม่มีคำอธิบาย' : 'A technical reason has no plain-language explanation yet'),
    explanation: lang === 'th'
      ? 'Frontend จะไม่เดาเหตุผลจากข้อมูลที่ไม่มีอยู่ เพื่อให้คำอธิบายตรงกับหลักฐานจาก Manager_Agent เท่านั้น'
      : 'The Frontend will not guess missing rationale; explanations stay limited to evidence supplied by Manager_Agent.',
    action: lang === 'th'
      ? 'เปิดรายละเอียดทางเทคนิคและตรวจ reason code นี้ใน Manager_Agent'
      : 'Open technical details and inspect this reason code in Manager_Agent.',
  };
}

export function explainDecisionReasons(codes, options = {}) {
  const uniqueCodes = [...new Set((Array.isArray(codes) ? codes : []).filter(Boolean))];
  return uniqueCodes.map((code) => explainDecisionReason(code, options));
}
