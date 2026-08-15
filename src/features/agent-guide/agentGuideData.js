export const AGENT_GUIDE_CATEGORIES = Object.freeze([
  'orchestration',
  'analysis',
  'portfolio',
  'safety',
  'execution',
  'research',
]);

const localized = (en, th) => ({ en, th });

export const AGENT_GUIDE = Object.freeze([
  {
    id: 'manager',
    name: 'Manager_Agent',
    category: 'orchestration',
    role: localized('System orchestrator', 'ผู้จัดการและประสานงานระบบ'),
    mission: localized(
      'Coordinate the trading workflow, collect decisions from specialist agents, and move each request through the correct safety gates.',
      'ประสานงาน Agent ทั้งระบบ รวบรวมผลการวิเคราะห์ และพาคำขอแต่ละรายการผ่านลำดับความปลอดภัยที่ถูกต้อง',
    ),
    receives: ['Scanner_Agent', 'Technical_Agent', 'Fundamental_Agent', 'Market_Regime_Agent', 'Portfolio_Agent', 'Profit_Agent', 'Database_Agent'],
    responsibilities: [
      localized('Choose which specialist agent should run next.', 'เลือกว่าจะเรียก Agent ผู้เชี่ยวชาญตัวใดต่อไป'),
      localized('Keep correlation IDs and decision context consistent across the workflow.', 'รักษา correlation ID และบริบทของการตัดสินใจให้ต่อเนื่องทั้ง workflow'),
      localized('Send trade proposals through Risk_Agent before execution.', 'ส่งข้อเสนอการเทรดผ่าน Risk_Agent ก่อน Execution เสมอ'),
    ],
    rules: [
      localized('Risk approval is mandatory before an order reaches Execution_Agent.', 'ต้องได้รับการอนุมัติจาก Risk_Agent ก่อนส่ง Order ไป Execution_Agent'),
      localized('Use Database_Agent as the source of truth for persisted lifecycle state.', 'ใช้ Database_Agent เป็นแหล่งข้อมูลจริงสำหรับสถานะ lifecycle ที่บันทึกไว้'),
      localized('Treat advisory outputs as recommendations, not broker instructions.', 'มองผลลัพธ์จาก Agent วิเคราะห์เป็นคำแนะนำ ไม่ใช่คำสั่ง Broker'),
    ],
    forbidden: [
      localized('Do not bypass Risk_Agent because another agent is confident.', 'ห้ามข้าม Risk_Agent แม้ Agent อื่นจะมี confidence สูง'),
      localized('Do not let the frontend become a dependency of the hourly trading workflow.', 'ห้ามให้ Frontend กลายเป็น dependency ของ hourly trading workflow'),
    ],
    sendsTo: ['Risk_Agent', 'Database_Agent', 'Profit_Agent', 'Portfolio_Agent', 'Backtest_Agent'],
    example: localized(
      'Scanner finds a candidate. Manager gathers analysis, checks persisted position state, asks Risk for approval, and only then allows execution.',
      'Scanner พบหุ้นที่น่าสนใจ Manager รวบรวมผลวิเคราะห์ ตรวจสถานะ Position จากฐานข้อมูล ขออนุมัติ Risk และจึงอนุญาตให้เข้าสู่ขั้น Execution',
    ),
  },
  {
    id: 'database',
    name: 'Database_Agent',
    category: 'orchestration',
    role: localized('Persistence and source of truth', 'ผู้เก็บข้อมูลจริงของระบบ'),
    mission: localized(
      'Persist positions, decisions, lifecycle state, and historical evidence so every agent works from consistent data.',
      'บันทึก Position การตัดสินใจ lifecycle และหลักฐานย้อนหลัง เพื่อให้ทุก Agent อ้างอิงข้อมูลชุดเดียวกัน',
    ),
    receives: ['Manager_Agent', 'Backtest_Agent', 'Execution_Agent'],
    responsibilities: [
      localized('Store position lifecycle and decision records.', 'บันทึก lifecycle ของ Position และ decision records'),
      localized('Return exact records instead of inventing missing state.', 'คืนข้อมูลที่ตรงกับที่บันทึกไว้ และไม่สร้างสถานะที่ไม่มีจริง'),
      localized('Support idempotency and duplicate protection with durable records.', 'รองรับ idempotency และป้องกันการทำรายการซ้ำด้วยข้อมูลถาวร'),
    ],
    rules: [
      localized('Persist state changes atomically when the contract requires it.', 'บันทึกการเปลี่ยนสถานะแบบ atomic เมื่อ contract กำหนด'),
      localized('Keep position version and decision identity consistent.', 'รักษา position version และ decision identity ให้สอดคล้องกัน'),
    ],
    forbidden: [
      localized('Do not decide whether to buy or sell.', 'ห้ามตัดสินใจซื้อหรือขาย'),
      localized('Do not silently overwrite conflicting lifecycle state.', 'ห้ามเขียนทับ lifecycle ที่ขัดแย้งกันแบบเงียบ ๆ'),
    ],
    sendsTo: ['Manager_Agent', 'Portfolio_Agent', 'Profit_Agent', 'Performance_Agent'],
    example: localized(
      'Profit_Agent proposes a partial exit. Database_Agent records the decision identity and lifecycle state so a retry cannot create the same exit twice.',
      'Profit_Agent เสนอขายบางส่วน Database_Agent บันทึก decision identity และ lifecycle เพื่อให้การ retry ไม่สร้างคำสั่งขายซ้ำ',
    ),
  },
  {
    id: 'scanner',
    name: 'Scanner_Agent',
    category: 'analysis',
    role: localized('Market candidate discovery', 'ผู้ค้นหาโอกาสในตลาด'),
    mission: localized(
      'Scan the market for symbols that match configured opportunity criteria and send candidates for deeper analysis.',
      'สแกนตลาดเพื่อหาสัญลักษณ์ที่ตรงกับเงื่อนไขโอกาส และส่งผู้สมัครให้ Agent อื่นวิเคราะห์ต่อ',
    ),
    receives: ['Market data', 'Manager_Agent'],
    responsibilities: [
      localized('Find and rank candidates using configured filters.', 'ค้นหาและจัดอันดับ Candidate ตาม filter ที่กำหนด'),
      localized('Publish evidence that explains why each candidate was selected.', 'ส่งหลักฐานว่าเหตุใด Candidate จึงถูกเลือก'),
    ],
    rules: [
      localized('Discovery is advisory and must be followed by downstream analysis and risk checks.', 'การค้นหาเป็นเพียงคำแนะนำ ต้องผ่านการวิเคราะห์และตรวจ Risk ต่อ'),
      localized('Return no candidate when the evidence does not meet the threshold.', 'หากหลักฐานไม่ถึงเกณฑ์ ให้คืนว่าไม่มี Candidate'),
    ],
    forbidden: [
      localized('Do not place orders.', 'ห้ามส่ง Order'),
      localized('Do not treat a scan hit as approval to trade.', 'ห้ามถือว่าการสแกนพบเท่ากับอนุมัติให้เทรด'),
    ],
    sendsTo: ['Manager_Agent', 'Technical_Agent', 'Fundamental_Agent', 'Backtest_Agent'],
    example: localized(
      'A symbol passes liquidity and momentum filters. Scanner reports it as a candidate, but the system still needs analysis, portfolio checks, and risk approval.',
      'หุ้นผ่านเงื่อนไขสภาพคล่องและ Momentum Scanner รายงานเป็น Candidate แต่ระบบยังต้องวิเคราะห์ ตรวจพอร์ต และขอ Risk approval',
    ),
  },
  {
    id: 'technical',
    name: 'Technical_Agent',
    category: 'analysis',
    role: localized('Technical market analyst', 'นักวิเคราะห์ทางเทคนิค'),
    mission: localized(
      'Interpret price action, trend, momentum, volatility, and technical indicators to produce a structured advisory view.',
      'ตีความราคา แนวโน้ม Momentum ความผันผวน และ Indicator เพื่อสร้างคำแนะนำเชิงโครงสร้าง',
    ),
    receives: ['Manager_Agent', 'Scanner_Agent', 'Market data'],
    responsibilities: [
      localized('Measure trend and momentum strength.', 'วัดความแข็งแรงของแนวโน้มและ Momentum'),
      localized('Identify technical invalidation and support/resistance context.', 'ระบุจุด invalidation และบริบทแนวรับแนวต้าน'),
    ],
    rules: [
      localized('Attach evidence to bullish, bearish, or neutral conclusions.', 'แนบหลักฐานให้ข้อสรุป bullish bearish หรือ neutral'),
      localized('Prefer neutral when signals conflict materially.', 'หากสัญญาณขัดแย้งกันอย่างมีนัยสำคัญ ให้เอนเอียงไปทาง neutral'),
    ],
    forbidden: [
      localized('Do not place broker orders.', 'ห้ามส่งคำสั่ง Broker'),
      localized('Do not override portfolio or risk limits.', 'ห้าม override ข้อจำกัด Portfolio หรือ Risk'),
    ],
    sendsTo: ['Manager_Agent', 'Curator_Agent'],
    example: localized(
      'Momentum is positive but price is near invalidation. Technical_Agent reports a cautious bullish view instead of turning the signal into an order.',
      'Momentum เป็นบวกแต่ราคาใกล้จุด invalidation Technical_Agent จึงรายงาน bullish แบบระมัดระวัง ไม่เปลี่ยนสัญญาณเป็น Order เอง',
    ),
  },
  {
    id: 'fundamental',
    name: 'Fundamental_Agent',
    category: 'analysis',
    role: localized('Business and valuation analyst', 'นักวิเคราะห์พื้นฐานธุรกิจ'),
    mission: localized(
      'Assess company quality, financial strength, valuation context, and durable business risks before a candidate is trusted.',
      'ประเมินคุณภาพบริษัท ความแข็งแรงทางการเงิน Valuation และความเสี่ยงทางธุรกิจก่อนเชื่อ Candidate',
    ),
    receives: ['Manager_Agent', 'Scanner_Agent', 'Fundamental data'],
    responsibilities: [
      localized('Evaluate business and financial quality.', 'ประเมินคุณภาพธุรกิจและฐานะการเงิน'),
      localized('Surface material risks that technical signals may not reveal.', 'เปิดเผยความเสี่ยงสำคัญที่กราฟอาจไม่แสดง'),
    ],
    rules: [
      localized('Separate facts from interpretation and confidence.', 'แยกข้อเท็จจริงออกจากการตีความและ confidence'),
      localized('Flag stale or incomplete inputs instead of filling gaps with assumptions.', 'แจ้งเตือนเมื่อข้อมูลเก่าหรือไม่ครบ แทนการเติมช่องว่างด้วยการเดา'),
    ],
    forbidden: [
      localized('Do not treat a good company as an automatic buy.', 'ห้ามถือว่าบริษัทดีเท่ากับต้องซื้อ'),
      localized('Do not bypass market regime or risk controls.', 'ห้ามข้าม Market Regime หรือ Risk controls'),
    ],
    sendsTo: ['Manager_Agent', 'Curator_Agent'],
    example: localized(
      'A chart looks strong, but the company has deteriorating fundamentals. Fundamental_Agent lowers confidence and explains the conflict for Manager to resolve.',
      'กราฟแข็งแรงแต่พื้นฐานบริษัทแย่ลง Fundamental_Agent ลด confidence และอธิบายความขัดแย้งให้ Manager ใช้ประกอบการตัดสินใจ',
    ),
  },
  {
    id: 'market_regime',
    name: 'Market_Regime_Agent',
    category: 'analysis',
    role: localized('Market environment classifier', 'ผู้จำแนกสภาพตลาด'),
    mission: localized(
      'Classify the market environment and convert it into strategy, exposure, and risk posture guidance.',
      'จำแนกสภาพตลาดและแปลงเป็นคำแนะนำด้าน Strategy Exposure และระดับความเสี่ยง',
    ),
    receives: ['Manager_Agent', 'Market data'],
    responsibilities: [
      localized('Classify bull, bear, sideways, volatile, or other supported regimes.', 'จำแนก Bull Bear Sideways Volatile หรือ regime ที่รองรับ'),
      localized('Publish allowed strategies and exposure guidance that agree with each other.', 'ส่ง allowed strategies และ exposure guidance ที่ไม่ขัดแย้งกัน'),
    ],
    rules: [
      localized('When no strategy is allowed, position-size and exposure multipliers must also resolve to zero.', 'เมื่อไม่มี Strategy ใดได้รับอนุญาต multiplier ของขนาด Position และ Exposure ต้องเป็นศูนย์ด้วย'),
      localized('High-risk or no-trade states must fail closed.', 'สถานะ High Risk หรือ No Trade ต้อง fail closed'),
    ],
    forbidden: [
      localized('Do not emit a NO_TRADE policy with non-zero exposure guidance.', 'ห้ามส่ง NO_TRADE พร้อม exposure guidance ที่มากกว่าศูนย์'),
      localized('Do not execute trades.', 'ห้าม Execute การเทรด'),
    ],
    sendsTo: ['Manager_Agent', 'Portfolio_Agent', 'Risk_Agent', 'Curator_Agent'],
    example: localized(
      'The regime is BEAR and risk is HIGH. The agent returns no allowed strategy and zero exposure multipliers so downstream agents cannot misread the policy.',
      'ตลาดเป็น BEAR และ Risk เป็น HIGH Agent คืนว่าไม่มี Strategy ที่อนุญาต พร้อม multiplier เป็นศูนย์ เพื่อไม่ให้ Agent ถัดไปตีความผิด',
    ),
  },
  {
    id: 'curator',
    name: 'Curator_Agent',
    category: 'analysis',
    role: localized('Signal curator', 'ผู้คัดกรองสัญญาณ'),
    mission: localized(
      'Combine specialist opinions into a cleaner advisory signal while preserving evidence and uncertainty.',
      'รวมความคิดเห็นจาก Agent ผู้เชี่ยวชาญให้เป็นสัญญาณที่อ่านง่ายขึ้น พร้อมเก็บหลักฐานและความไม่แน่นอนไว้',
    ),
    receives: ['Technical_Agent', 'Fundamental_Agent', 'Market_Regime_Agent', 'Manager_Agent'],
    responsibilities: [
      localized('Resolve agreement and disagreement across analysis agents.', 'สรุปจุดที่ Agent วิเคราะห์เห็นตรงกันและขัดแย้งกัน'),
      localized('Produce a curated advisory signal with traceable reasons.', 'สร้าง advisory signal ที่ตรวจสอบเหตุผลย้อนกลับได้'),
    ],
    rules: [
      localized('Untrusted skill execution belongs inside the hardened container sandbox.', 'การรัน skill ที่ไม่เชื่อถือ ต้องอยู่ใน container sandbox ที่แข็งแรง'),
      localized('Sandbox failure must fail closed unless an explicit safe policy says otherwise.', 'เมื่อ sandbox ล้มเหลว ต้อง fail closed เว้นแต่นโยบายปลอดภัยกำหนดไว้ชัดเจน'),
    ],
    forbidden: [
      localized('Do not silently fall back to weaker code execution when the sandbox fails.', 'ห้าม fallback ไปใช้การรันโค้ดที่อ่อนแอกว่าแบบเงียบ ๆ เมื่อ sandbox ล้มเหลว'),
      localized('Do not place broker orders.', 'ห้ามส่งคำสั่ง Broker'),
    ],
    sendsTo: ['Manager_Agent'],
    example: localized(
      'Technical is bullish, Fundamental is neutral, and regime risk is elevated. Curator preserves the disagreement and sends a lower-confidence advisory signal.',
      'Technical เป็น bullish, Fundamental เป็น neutral และ regime risk สูง Curator เก็บความขัดแย้งไว้และส่ง advisory signal ที่ confidence ต่ำลง',
    ),
  },
  {
    id: 'portfolio',
    name: 'Portfolio_Agent',
    category: 'portfolio',
    role: localized('Portfolio allocator', 'ผู้จัดสรรและควบคุมพอร์ต'),
    mission: localized(
      'Evaluate the proposed trade in the context of existing positions, concentration, exposure, and allocation goals.',
      'ประเมินการเทรดใหม่ร่วมกับ Position ที่มีอยู่ ความกระจุกตัว Exposure และเป้าหมายการจัดสรรพอร์ต',
    ),
    receives: ['Manager_Agent', 'Database_Agent', 'Market_Regime_Agent'],
    responsibilities: [
      localized('Check portfolio concentration and available capacity.', 'ตรวจความกระจุกตัวและพื้นที่ความเสี่ยงที่เหลือในพอร์ต'),
      localized('Recommend allocation or reduction without executing it.', 'แนะนำการจัดสรรหรือการลด Position โดยไม่ Execute เอง'),
    ],
    rules: [
      localized('Evaluate the whole portfolio, not only the attractiveness of one symbol.', 'ประเมินทั้งพอร์ต ไม่ใช่ดูแค่ความน่าสนใจของหุ้นตัวเดียว'),
      localized('Respect regime and risk constraints when sizing recommendations.', 'เคารพข้อจำกัดจาก Regime และ Risk เมื่อแนะนำขนาด Position'),
    ],
    forbidden: [
      localized('Do not exceed portfolio guardrails to chase a high-confidence signal.', 'ห้ามเกิน Portfolio guardrails เพื่อไล่ตามสัญญาณ confidence สูง'),
      localized('Do not execute orders.', 'ห้าม Execute Order'),
    ],
    sendsTo: ['Manager_Agent', 'Risk_Agent'],
    example: localized(
      'A candidate looks strong, but the portfolio already has heavy exposure to the same theme. Portfolio_Agent recommends a smaller allocation or no new position.',
      'Candidate ดูแข็งแรง แต่พอร์ตมี Exposure ในธีมเดียวกันสูงอยู่แล้ว Portfolio_Agent จึงแนะนำขนาดเล็กลงหรือไม่เพิ่ม Position',
    ),
  },
  {
    id: 'profit',
    name: 'Profit_Agent',
    category: 'portfolio',
    role: localized('Profit lifecycle advisor', 'ผู้ดูแลวงจรกำไร'),
    mission: localized(
      'Protect gains and manage exits with deterministic stop, target, trailing-stop, and partial-exit recommendations.',
      'ปกป้องกำไรและจัดการ Exit ด้วยคำแนะนำ Stop, Target, Trailing Stop และ Partial Exit แบบ deterministic',
    ),
    receives: ['Manager_Agent', 'Database_Agent', 'Position lifecycle state'],
    responsibilities: [
      localized('Detect hard-stop and trailing-stop breaches.', 'ตรวจ Hard Stop และ Trailing Stop breach'),
      localized('Recommend hold, partial exit, stop movement, or full exit.', 'แนะนำ Hold, Partial Exit, เลื่อน Stop หรือ Exit ทั้งหมด'),
      localized('Create deterministic decision identities for idempotent lifecycle handling.', 'สร้าง decision identity แบบ deterministic เพื่อรองรับ idempotent lifecycle'),
    ],
    rules: [
      localized('Remain stateless and rely on Database_Agent for durable lifecycle state.', 'ต้อง stateless และใช้ Database_Agent สำหรับ lifecycle state ที่ถาวร'),
      localized('Every actionable exit recommendation still requires Risk_Agent approval.', 'คำแนะนำ Exit ที่นำไปปฏิบัติได้ทุกครั้งยังต้องผ่าน Risk_Agent'),
      localized('Never mark an exit executed before broker fill evidence exists.', 'ห้ามถือว่า Exit สำเร็จก่อนมีหลักฐาน Fill จาก Broker'),
    ],
    forbidden: [
      localized('Do not call Execution_Agent directly.', 'ห้ามเรียก Execution_Agent โดยตรง'),
      localized('Do not place broker orders or hold broker credentials.', 'ห้ามส่ง Broker Order หรือถือ Broker credentials'),
      localized('Do not recommend the same partial exit twice for the same lifecycle state.', 'ห้ามแนะนำ Partial Exit ซ้ำสำหรับ lifecycle state เดิม'),
    ],
    sendsTo: ['Manager_Agent', 'Risk_Agent'],
    example: localized(
      'Price crosses the trailing stop. Profit_Agent recommends exit_all with the stop evidence, Manager sends it to Risk, and execution can happen only after approval.',
      'ราคาหลุด Trailing Stop Profit_Agent แนะนำ exit_all พร้อมหลักฐาน จากนั้น Manager ส่งให้ Risk และจึง Execute ได้หลังผ่านการอนุมัติ',
    ),
  },
  {
    id: 'risk',
    name: 'Risk_Agent',
    category: 'safety',
    role: localized('Final safety gate', 'ประตูความปลอดภัยก่อนเทรด'),
    mission: localized(
      'Approve, reject, or block proposed actions based on exposure, limits, emergency state, and trading safety policy.',
      'อนุมัติ ปฏิเสธ หรือบล็อกการกระทำตาม Exposure, Limits, Emergency state และนโยบายความปลอดภัย',
    ),
    receives: ['Manager_Agent', 'Portfolio_Agent', 'Profit_Agent', 'Market_Regime_Agent'],
    responsibilities: [
      localized('Enforce position, exposure, concentration, and session limits.', 'บังคับใช้ Position, Exposure, Concentration และ Session limits'),
      localized('Enforce the runtime emergency halt state.', 'บังคับใช้ Runtime Emergency Halt'),
      localized('Return a clear approval or rejection reason.', 'คืนเหตุผลอนุมัติหรือปฏิเสธอย่างชัดเจน'),
    ],
    rules: [
      localized('Emergency halt must be checked at runtime, not only when the process starts.', 'Emergency Halt ต้องตรวจตอน runtime ไม่ใช่อ่านเฉพาะตอน process เริ่ม'),
      localized('Unsafe, stale, or contradictory requests fail closed.', 'Request ที่ไม่ปลอดภัย เก่า หรือขัดแย้งกันต้อง fail closed'),
      localized('A rejected request must never reach execution.', 'Request ที่ถูก Reject ต้องไม่ไปถึง Execution'),
    ],
    forbidden: [
      localized('Do not approve a request that violates a hard guardrail.', 'ห้าม Approve Request ที่ละเมิด Hard Guardrail'),
      localized('Do not expose emergency halt controls without administrator authentication.', 'ห้ามเปิด Emergency Halt control โดยไม่มี Admin authentication'),
    ],
    sendsTo: ['Manager_Agent', 'Execution_Agent'],
    example: localized(
      'Portfolio exposure is already near its limit. A new order would exceed the cap, so Risk_Agent rejects it and Execution_Agent must never receive it.',
      'Portfolio Exposure ใกล้เต็ม Limit แล้ว Order ใหม่จะเกิน Cap ดังนั้น Risk_Agent Reject และ Execution_Agent ต้องไม่ได้รับ Order นี้',
    ),
  },
  {
    id: 'execution',
    name: 'Execution_Agent',
    category: 'execution',
    role: localized('Approved order executor', 'ผู้ส่ง Order ที่ได้รับอนุมัติแล้ว'),
    mission: localized(
      'Translate an approved, validated trading instruction into a broker or simulator order and report the resulting status.',
      'แปลงคำสั่งเทรดที่ผ่านการอนุมัติและ Validation เป็น Broker หรือ Simulator Order แล้วรายงานสถานะกลับ',
    ),
    receives: ['Risk_Agent', 'Manager_Agent'],
    responsibilities: [
      localized('Validate executable order details before submission.', 'ตรวจรายละเอียด Order ที่ต้อง Execute ก่อนส่ง'),
      localized('Submit only approved paper or simulator orders under the active runtime policy.', 'ส่งเฉพาะ Paper หรือ Simulator Order ที่ผ่าน Approval ตาม runtime policy'),
      localized('Report order and fill state for reconciliation.', 'รายงาน Order และ Fill state เพื่อใช้ Reconciliation'),
    ],
    rules: [
      localized('Execution starts only after explicit risk approval.', 'Execution เริ่มได้หลังมี Risk approval ชัดเจนเท่านั้น'),
      localized('Broker results must be reconciled with persisted position state.', 'ผลจาก Broker ต้องถูก Reconcile กับ Position state ที่บันทึกไว้'),
    ],
    forbidden: [
      localized('Do not invent trading decisions.', 'ห้ามสร้าง Trading Decision เอง'),
      localized('Do not execute unapproved or stale instructions.', 'ห้าม Execute คำสั่งที่ยังไม่ Approve หรือ Stale'),
      localized('Do not silently retry in a way that can duplicate orders.', 'ห้าม Retry แบบที่อาจสร้าง Order ซ้ำโดยไม่มี idempotency protection'),
    ],
    sendsTo: ['Manager_Agent', 'Database_Agent', 'Broker / Simulator'],
    example: localized(
      'Risk approves a paper-trading bracket order. Execution submits it, captures the broker response, and returns identifiers for Manager and Database reconciliation.',
      'Risk อนุมัติ Paper Trading Bracket Order จากนั้น Execution ส่ง Order เก็บ Broker response และคืน identifier ให้ Manager กับ Database ใช้ Reconcile',
    ),
  },
  {
    id: 'performance',
    name: 'Performance_Agent',
    category: 'research',
    role: localized('Performance analyst', 'นักวิเคราะห์ผลงานระบบ'),
    mission: localized(
      'Measure trading outcomes, strategy behavior, drawdown, and decision quality to explain what is helping or hurting performance.',
      'วัดผลลัพธ์การเทรด พฤติกรรม Strategy Drawdown และคุณภาพการตัดสินใจ เพื่ออธิบายว่าอะไรช่วยหรือทำร้ายผลลัพธ์',
    ),
    receives: ['Database_Agent', 'Manager_Agent', 'Execution history'],
    responsibilities: [
      localized('Calculate reproducible performance metrics.', 'คำนวณ Performance metrics ที่ทำซ้ำได้'),
      localized('Separate strategy quality from execution and market effects where possible.', 'แยกผลจาก Strategy, Execution และ Market เท่าที่ข้อมูลรองรับ'),
    ],
    rules: [
      localized('Use completed evidence, not optimistic assumptions, for performance reporting.', 'ใช้หลักฐานที่เกิดขึ้นจริง ไม่ใช่สมมติฐานเชิงบวกในการรายงาน Performance'),
      localized('Keep analysis traceable to source records.', 'ทำให้ผลวิเคราะห์ย้อนกลับไปหา Source records ได้'),
    ],
    forbidden: [
      localized('Do not rewrite historical outcomes to improve metrics.', 'ห้ามแก้ประวัติย้อนหลังเพื่อทำให้ Metric ดูดีขึ้น'),
      localized('Do not execute trades.', 'ห้าม Execute การเทรด'),
    ],
    sendsTo: ['Manager_Agent', 'Learning_Agent'],
    example: localized(
      'Win rate improved but drawdown also increased. Performance_Agent reports both facts so the system does not optimize one metric while hiding another cost.',
      'Win rate ดีขึ้นแต่ Drawdown ก็สูงขึ้น Performance_Agent รายงานทั้งสองด้าน เพื่อไม่ให้ระบบ optimize Metric หนึ่งโดยซ่อนต้นทุนอีกด้าน',
    ),
  },
  {
    id: 'learning',
    name: 'Learning_Agent',
    category: 'research',
    role: localized('Learning and improvement advisor', 'ผู้เรียนรู้และเสนอการปรับปรุง'),
    mission: localized(
      'Use historical outcomes and performance evidence to propose safer strategy or policy improvements.',
      'ใช้ผลลัพธ์ย้อนหลังและ Performance evidence เพื่อเสนอการปรับ Strategy หรือนโยบายอย่างปลอดภัย',
    ),
    receives: ['Performance_Agent', 'Database_Agent', 'Backtest_Agent'],
    responsibilities: [
      localized('Identify recurring strengths, weaknesses, and drift.', 'ค้นหารูปแบบจุดแข็ง จุดอ่อน และ Drift ที่เกิดซ้ำ'),
      localized('Propose changes that can be tested before production use.', 'เสนอการเปลี่ยนแปลงที่สามารถทดสอบก่อนใช้จริง'),
    ],
    rules: [
      localized('Treat learning output as a proposal until validated.', 'มอง Learning output เป็นข้อเสนอจนกว่าจะผ่าน Validation'),
      localized('Use backtesting and controlled evaluation before promoting material strategy changes.', 'ใช้ Backtest และ Controlled Evaluation ก่อน Promote การเปลี่ยน Strategy ที่สำคัญ'),
    ],
    forbidden: [
      localized('Do not self-modify production risk rules without review.', 'ห้ามแก้ Production Risk Rules ด้วยตัวเองโดยไม่มี Review'),
      localized('Do not send broker orders.', 'ห้ามส่ง Broker Order'),
    ],
    sendsTo: ['Manager_Agent', 'Backtest_Agent'],
    example: localized(
      'A strategy loses repeatedly in high-volatility regimes. Learning_Agent proposes a tighter eligibility rule and sends the hypothesis to Backtest before production adoption.',
      'Strategy แพ้ซ้ำในช่วง Volatility สูง Learning_Agent เสนอ Eligibility rule ที่เข้มขึ้น และส่งสมมติฐานไป Backtest ก่อนนำไปใช้จริง',
    ),
  },
  {
    id: 'backtest',
    name: 'Backtest_Agent',
    category: 'research',
    role: localized('Strategy research laboratory', 'ห้องทดลอง Strategy'),
    mission: localized(
      'Run reproducible historical simulations to test strategy hypotheses without touching live or paper broker execution.',
      'รัน Simulation ย้อนหลังแบบทำซ้ำได้เพื่อทดสอบสมมติฐาน Strategy โดยไม่แตะ Broker execution',
    ),
    receives: ['Manager_Agent', 'Scanner_Agent', 'Learning_Agent', 'Historical market data'],
    responsibilities: [
      localized('Run single-symbol and batch backtests with reproducible inputs.', 'รัน Backtest แบบ Single Symbol และ Batch ด้วย Input ที่ทำซ้ำได้'),
      localized('Persist exact results through Database_Agent when configured.', 'บันทึกผลลัพธ์ที่ตรงกันผ่าน Database_Agent เมื่อมีการตั้งค่า'),
      localized('Expose statistics, trades, and evidence for review.', 'เปิดเผยสถิติ Trades และ Evidence ให้ตรวจสอบ'),
    ],
    rules: [
      localized('Historical simulation must stay isolated from trading execution.', 'Historical simulation ต้องแยกออกจาก Trading Execution'),
      localized('Record the strategy parameters and data window used by each run.', 'บันทึก Strategy parameters และช่วงข้อมูลของแต่ละ Run'),
    ],
    forbidden: [
      localized('Do not place broker orders.', 'ห้ามส่ง Broker Order'),
      localized('Do not present backtest profit as guaranteed future performance.', 'ห้ามนำกำไรจาก Backtest ไปอ้างว่าเป็นผลตอบแทนในอนาคตที่รับประกันได้'),
    ],
    sendsTo: ['Manager_Agent', 'Database_Agent', 'Learning_Agent', 'Performance_Agent'],
    example: localized(
      'Learning proposes a new volatility filter. Backtest compares the old and new rules across the same historical window before Manager considers adopting it.',
      'Learning เสนอ Volatility filter ใหม่ Backtest เปรียบเทียบกฎเก่าและใหม่บนช่วงข้อมูลเดียวกัน ก่อน Manager พิจารณานำไปใช้',
    ),
  },
]);

export const AGENT_FLOW_STAGES = Object.freeze([
  {
    id: 'discover',
    agents: ['scanner'],
    title: localized('1. Discover', '1. ค้นหา'),
    description: localized('Find market candidates worth investigating.', 'ค้นหา Candidate ในตลาดที่ควรวิเคราะห์ต่อ'),
  },
  {
    id: 'analyze',
    agents: ['technical', 'fundamental', 'market_regime', 'curator'],
    title: localized('2. Analyze', '2. วิเคราะห์'),
    description: localized('Build evidence from charts, fundamentals, regime, and signal curation.', 'สร้างหลักฐานจากกราฟ พื้นฐาน สภาพตลาด และการคัดกรองสัญญาณ'),
  },
  {
    id: 'coordinate',
    agents: ['manager', 'database', 'portfolio', 'profit'],
    title: localized('3. Coordinate', '3. ประสานงาน'),
    description: localized('Combine decisions with persisted position and portfolio context.', 'รวมการตัดสินใจกับสถานะ Position และบริบท Portfolio'),
  },
  {
    id: 'protect',
    agents: ['risk'],
    title: localized('4. Protect', '4. ป้องกันความเสี่ยง'),
    description: localized('Block any action that violates safety policy.', 'บล็อกการกระทำที่ผิดนโยบายความปลอดภัย'),
  },
  {
    id: 'execute',
    agents: ['execution'],
    title: localized('5. Execute', '5. ส่งคำสั่ง'),
    description: localized('Submit only the action that survived every required gate.', 'ส่งเฉพาะคำสั่งที่ผ่านทุก Gate ที่กำหนด'),
  },
  {
    id: 'learn',
    agents: ['performance', 'learning', 'backtest'],
    title: localized('6. Learn', '6. เรียนรู้'),
    description: localized('Measure outcomes, form hypotheses, and validate them safely.', 'วัดผล สร้างสมมติฐาน และทดสอบอย่างปลอดภัย'),
  },
]);

export function localize(value, language = 'en') {
  if (!value || typeof value !== 'object') return value;
  return value[language] ?? value.en ?? value.th ?? '';
}

export function filterAgentGuide({ agents = AGENT_GUIDE, query = '', category = 'all' } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  return agents.filter((agent) => {
    if (category !== 'all' && agent.category !== category) return false;
    if (!normalizedQuery) return true;
    const searchable = [
      agent.name,
      agent.role.en,
      agent.role.th,
      agent.mission.en,
      agent.mission.th,
      ...agent.responsibilities.flatMap((item) => [item.en, item.th]),
      ...agent.rules.flatMap((item) => [item.en, item.th]),
      ...agent.forbidden.flatMap((item) => [item.en, item.th]),
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });
}
