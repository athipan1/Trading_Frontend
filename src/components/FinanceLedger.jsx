import { useMemo, useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';

const formatBaht = (value) => new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 2,
}).format(Number(value || 0));

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceLedger({ entries, onCreate, onDelete, isConnected }) {
  const [form, setForm] = useState({
    entry_type: 'expense',
    amount: '',
    category: '',
    description: '',
    occurred_at: todayValue(),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = useMemo(() => entries.reduce((summary, entry) => {
    const amount = Number(entry.amount || 0);
    summary[entry.entry_type] += amount;
    return summary;
  }, { income: 0, expense: 0 }), [entries]);

  const submit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!isConnected || !Number.isFinite(amount) || amount <= 0 || !form.category.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      await onCreate({
        entry_id: crypto.randomUUID(),
        ...form,
        amount: amount.toFixed(2),
        category: form.category.trim(),
        description: form.description.trim(),
        occurred_at: new Date(`${form.occurred_at}T12:00:00`).toISOString(),
      });
      setForm((current) => ({ ...current, amount: '', category: '', description: '' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (entryId) => {
    setIsSaving(true);
    setError('');
    try {
      await onDelete(entryId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="control-page">
      <div className="control-heading">
        <div>
          <p className="eyebrow">Personal cash flow</p>
          <h2>บันทึกรายรับรายจ่าย</h2>
          <p className="hint">ข้อมูลบันทึกผ่าน Manager_Agent และเก็บใน Database_Agent</p>
        </div>
        <div className="ledger-balance">
          <span>คงเหลือสุทธิ</span>
          <strong className={totals.income - totals.expense >= 0 ? 'positive' : 'negative'}>
            {formatBaht(totals.income - totals.expense)}
          </strong>
        </div>
      </div>

      <div className="ledger-summary">
        <article><span>รายรับ</span><strong className="positive">{formatBaht(totals.income)}</strong></article>
        <article><span>รายจ่าย</span><strong className="negative">{formatBaht(totals.expense)}</strong></article>
        <article><span>จำนวนรายการ</span><strong>{entries.length}</strong></article>
      </div>

      <form className="ledger-form panel" onSubmit={submit}>
        <select value={form.entry_type} onChange={(event) => setForm({ ...form, entry_type: event.target.value })}>
          <option value="income">รายรับ</option>
          <option value="expense">รายจ่าย</option>
        </select>
        <input inputMode="decimal" placeholder="จำนวนเงิน" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <input placeholder="หมวดหมู่ เช่น อาหาร" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        <input placeholder="รายละเอียด" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input type="date" value={form.occurred_at} onChange={(event) => setForm({ ...form, occurred_at: event.target.value })} />
        <button className="primary-action" type="submit" disabled={!isConnected || isSaving}><PlusCircle /> เพิ่มรายการ</button>
      </form>

      {!isConnected ? <p className="error-banner">เชื่อมต่อ Manager_Agent ก่อนบันทึกข้อมูล</p> : null}
      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      <div className="panel ledger-list">
        {entries.length === 0 ? <p className="empty-control">ยังไม่มีรายการ เริ่มจากเงินเดือนหรือค่าใช้จ่ายวันนี้</p> : entries.map((entry) => (
          <article className="ledger-row" key={entry.entry_id}>
            <div>
              <strong>{entry.category}</strong>
              <p>{entry.description || new Date(entry.occurred_at).toLocaleDateString('th-TH')}</p>
            </div>
            <div className="ledger-row-value">
              <strong className={entry.entry_type === 'income' ? 'positive' : 'negative'}>
                {entry.entry_type === 'income' ? '+' : '-'}{formatBaht(entry.amount)}
              </strong>
              <button className="icon-button" type="button" disabled={isSaving} onClick={() => remove(entry.entry_id)} aria-label="ลบรายการ"><Trash2 /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
