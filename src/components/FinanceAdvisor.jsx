import { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { askFinancialAdvisor } from '../services/controlApi.js';

export default function FinanceAdvisor({
  accountId,
  operatorToken,
  entries,
  availableCapital,
  onAvailableCapitalChange,
}) {
  const [message, setMessage] = useState('วันนี้ฉันควรบริหารเงินและแบ่งเงินลงทุนอย่างไร');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'ฉันจะสรุปกระแสเงินสด วงเงินลงทุน และจุดที่ควรระวัง โดยไม่ส่งคำสั่งซื้อขายจากหน้าสนทนานี้' },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!message.trim() || isSending) return;
    const userText = message.trim();
    setMessages((current) => [...current, { role: 'user', text: userText }]);
    setMessage('');
    setError('');
    setIsSending(true);
    try {
      const response = await askFinancialAdvisor({
        operatorToken,
        accountId,
        entries: entries.map((entry) => ({
          entry_type: entry.entry_type,
          amount: entry.amount,
          category: entry.category,
          description: entry.description,
          occurred_at: entry.occurred_at,
        })),
        availableInvestmentCapital: availableCapital || 0,
        message: userText,
      });
      setMessages((current) => [...current, { role: 'assistant', text: response.data.answer, summary: response.data.summary }]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="control-page chat-layout">
      <div className="control-heading">
        <div>
          <p className="eyebrow">Daily financial copilot</p>
          <h2>คุยกับ AI การเงิน</h2>
          <p className="hint">AI อ่านเฉพาะข้อมูลที่คุณบันทึกและงบลงทุนส่วนบุคคลหน่วยบาท</p>
        </div>
        <label className="capital-input">
          <span>งบลงทุนจากกระแสเงินสด (THB)</span>
          <input
            inputMode="decimal"
            value={availableCapital}
            onChange={(event) => onAvailableCapitalChange(event.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>

      <div className="panel chat-window">
        {messages.map((item, index) => (
          <article className={`chat-bubble ${item.role}`} key={`${item.role}-${index}`}>
            <span>{item.role === 'assistant' ? 'AI การเงิน' : 'คุณ'}</span>
            <p>{item.text}</p>
            {item.summary ? (
              <div className="chat-summary">
                <small>กระแสเงินสดสุทธิ: ฿{Number(item.summary.net_cash_flow).toLocaleString('th-TH')}</small>
                <small>วงเงินลงทุนใหม่ที่แนะนำ: ฿{Number(item.summary.suggested_new_investment_cap).toLocaleString('th-TH')}</small>
              </div>
            ) : null}
          </article>
        ))}
        {isSending ? <p className="hint">กำลังประมวลผลแผนการเงิน…</p> : null}
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="ถามเรื่องรายรับ รายจ่าย เงินสำรอง หรือวงเงินลงทุน" />
        <button className="primary-action" type="submit" disabled={isSending}><Send /> ส่ง</button>
      </form>
    </section>
  );
}
