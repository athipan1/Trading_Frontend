import { useMemo, useState } from 'react';
import { Bot, LockKeyhole, Send, ShieldCheck } from 'lucide-react';
import PositionsTable from './PositionsTable.jsx';
import OrdersTable from './OrdersTable.jsx';
import { confirmInvestmentPlan, createInvestmentPlan, getInvestmentPlan } from '../services/controlApi.js';
import { formatCurrency } from '../utils/formatters.js';

function findTradePlanId(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.trade_plan_id === 'string') return value.trade_plan_id;
  if (typeof value.plan_id === 'string') return value.plan_id;
  for (const child of Object.values(value)) {
    const found = findTradePlanId(child);
    if (found) return found;
  }
  return null;
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function InvestmentCommandCenter({ accountId, operatorToken, snapshot, t, availableCapital, onAvailableCapitalChange }) {
  const [ticker, setTicker] = useState('AAPL');
  const [goal, setGoal] = useState('วิเคราะห์และสร้างแผนลงทุนที่ไม่เกินวงเงินของฉัน');
  const [chat, setChat] = useState([
    { role: 'assistant', text: 'ส่งชื่อหุ้นและเป้าหมายมาได้ ฉันจะให้ Manager_Agent วิเคราะห์แบบ dry-run และสร้าง TradePlan ก่อนเสมอ' },
  ]);
  const [planId, setPlanId] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  const account = snapshot.account;
  const positions = snapshot.positions;
  const openOrders = snapshot.openOrders;
  const totalPositionValue = useMemo(
    () => positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0),
    [positions],
  );

  const createPlan = async (event) => {
    event.preventDefault();
    const capital = Number(availableCapital);
    if (!Number.isFinite(capital) || capital <= 0) {
      setError('กรุณากำหนดเพดานคำสั่งเทรดเป็น USD มากกว่า 0 ก่อนสร้างแผน');
      return;
    }

    setIsWorking(true);
    setError('');
    setPlanId('');
    setConfirmationPhrase('');
    setConfirmationText('');
    setChat((current) => [...current, { role: 'user', text: `${ticker}: ${goal} | เพดาน ${formatUsd(capital)}` }]);
    try {
      const response = await createInvestmentPlan({
        operatorToken,
        accountId,
        ticker,
        userGoal: goal,
        maxInvestmentAmount: capital,
        investmentCurrency: 'USD',
      });
      const nextPlanId = response.metadata?.trade_plan_id || findTradePlanId(response);
      const budgetBlocked = Boolean(response.metadata?.budget_blocked);
      const confirmationReady = Boolean(response.metadata?.confirmation_ready);
      const planNotional = response.metadata?.plan_notional;

      if (budgetBlocked) {
        setChat((current) => [...current, {
          role: 'assistant',
          text: `แผน ${nextPlanId || ''} มีมูลค่า ${formatUsd(planNotional)} เกินเพดาน ${formatUsd(capital)} จึงถูกปฏิเสธและไม่สามารถยืนยันได้`,
        }]);
        return;
      }

      if (!confirmationReady) {
        setChat((current) => [...current, {
          role: 'assistant',
          text: response.metadata?.blocked_reason
            || 'TradePlan ไม่ผ่าน Risk approval หรือสถานะไม่พร้อมยืนยัน จึงไม่มีการเปิดปุ่มส่งคำสั่ง',
        }]);
        return;
      }

      setPlanId(nextPlanId || '');
      setChat((current) => [...current, {
        role: 'assistant',
        text: nextPlanId
          ? `Manager_Agent สร้างแผน ${nextPlanId} มูลค่า ${formatUsd(planNotional)} แล้ว ยังไม่มีการส่งคำสั่งซื้อขาย กรุณาตรวจแผนก่อนยืนยัน`
          : 'Manager_Agent วิเคราะห์เสร็จ แต่ไม่พบ TradePlan ที่พร้อมยืนยัน',
      }]);
      if (nextPlanId) {
        const planResponse = await getInvestmentPlan({ operatorToken, tradePlanId: nextPlanId });
        setConfirmationPhrase(planResponse.metadata?.confirmation_phrase || '');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsWorking(false);
    }
  };

  const confirm = async () => {
    if (!planId || isWorking) return;
    setIsWorking(true);
    setError('');
    try {
      const response = await confirmInvestmentPlan({
        operatorToken,
        accountId,
        tradePlanId: planId,
        confirmationText,
      });
      setChat((current) => [...current, {
        role: 'assistant',
        text: `ผลการส่งคำสั่ง: ${response.data?.status || response.status} | Plan ${planId}`,
      }]);
      setConfirmationText('');
      setPlanId('');
      setConfirmationPhrase('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="control-page">
      <div className="investment-account panel">
        <div>
          <p className="eyebrow">Investment account</p>
          <h2>บัญชีเงินลงทุน</h2>
          <p className="hint">บัญชี Alpaca และ TradePlan ใช้ USD ช่องนี้จึงแยกจากงบการเงินส่วนบุคคลที่เป็น THB</p>
        </div>
        <label className="capital-input">
          <span>เพดานคำสั่งเทรดต่อแผน (USD)</span>
          <input inputMode="decimal" value={availableCapital} onChange={(event) => onAvailableCapitalChange(event.target.value)} placeholder="0.00" />
        </label>
      </div>

      <div className="metrics-grid command-metrics">
        <article className="metric-card cash"><span>เงินสด Broker (USD)</span><strong>{formatCurrency(account.cash)}</strong></article>
        <article className="metric-card"><span>Equity (USD)</span><strong>{formatCurrency(account.equity)}</strong></article>
        <article className="metric-card"><span>มูลค่าพอร์ต (USD)</span><strong>{formatCurrency(totalPositionValue)}</strong></article>
        <article className="metric-card"><span>คำสั่งเปิด</span><strong>{openOrders.length}</strong></article>
      </div>

      <div className="content-grid">
        <PositionsTable positions={positions} openOrders={openOrders} t={t} />
        <OrdersTable orders={openOrders} t={t} />
      </div>

      <div className="panel trade-chat">
        <div className="section-heading">
          <div><p className="eyebrow">Manager command gateway</p><h2>วางแผนกับ AI และยืนยันคำสั่ง</h2></div>
          <ShieldCheck />
        </div>
        <div className="chat-window compact">
          {chat.map((item, index) => (
            <article className={`chat-bubble ${item.role}`} key={`${item.role}-${index}`}>
              <span>{item.role === 'assistant' ? 'Manager AI' : 'คุณ'}</span>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <form className="trade-plan-form" onSubmit={createPlan}>
          <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder="Symbol" />
          <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="เป้าหมายและข้อจำกัด" />
          <button className="primary-action" type="submit" disabled={isWorking}><Bot /> สร้างแผน</button>
        </form>

        {planId ? (
          <div className="confirmation-box">
            <LockKeyhole />
            <div>
              <strong>ยืนยัน TradePlan: {planId}</strong>
              <p>พิมพ์ข้อความให้ตรงทุกตัวอักษร: <code>{confirmationPhrase || 'กำลังโหลดข้อความยืนยัน'}</code></p>
              <div className="confirmation-row">
                <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} placeholder="ข้อความยืนยัน" />
                <button className="danger-action" type="button" onClick={confirm} disabled={isWorking || confirmationText !== confirmationPhrase}><Send /> ยืนยันและส่งคำสั่ง</button>
              </div>
            </div>
          </div>
        ) : null}
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
