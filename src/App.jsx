import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Languages,
  LockKeyhole,
  NotebookTabs,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Zap,
} from 'lucide-react';
import FinanceAdvisor from './components/FinanceAdvisor.jsx';
import FinanceLedger from './components/FinanceLedger.jsx';
import HourlyAutomationStatus from './components/HourlyAutomationStatus.jsx';
import InvestmentCommandCenter from './components/InvestmentCommandCenter.jsx';
import MetricCard from './components/MetricCard.jsx';
import OrdersTable from './components/OrdersTable.jsx';
import PositionsTable from './components/PositionsTable.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import { DATA_SOURCES } from './config/dashboardConfig.js';
import { emptyDashboardSnapshot } from './data/emptyDashboard.js';
import { useDashboardSnapshot } from './hooks/useDashboardSnapshot.js';
import { getInitialLanguage, translations } from './i18n.js';
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getControlCapabilities,
  getFinanceState,
  updateFinanceBudgets,
} from './services/controlApi.js';
import { getDashboardDataSource } from './services/api.js';
import { formatCurrency } from './utils/formatters.js';

function formatUpdatedAt(value, language, fallback) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function safeRefreshError(error, language) {
  const fallback = language === 'th' ? 'โหลด Snapshot ไม่สำเร็จ' : 'Snapshot refresh failed';
  const message = typeof error?.message === 'string' ? error.message : fallback;
  return message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
}

function PortfolioOverview({ snapshot, language, t, isLoading, isRefreshing, refresh }) {
  const { account, positions, openOrders } = snapshot;
  const signals = snapshot.signals ?? snapshot.curatorSignals ?? [];
  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const protectedPositions = positions.filter((position) =>
    openOrders.some((order) => order.symbol === position.symbol && order.orderClass === 'bracket'),
  ).length;
  const maskedValue = language === 'th' ? 'ปกปิด' : 'Masked';
  const accountValue = (value) => (account.valuesMasked || value === null ? maskedValue : formatCurrency(value));

  return (
    <>
      <HourlyAutomationStatus
        snapshot={snapshot}
        language={language}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
      />

      <section className="metrics-grid" aria-label={language === 'th' ? 'ข้อมูลบัญชี' : 'Account metrics'}>
        <MetricCard label={t.cash} value={accountValue(account.cash)} helper={account.valuesMasked ? maskedValue : t.availableBalance} tone="cash" />
        <MetricCard label={t.equity} value={accountValue(account.equity)} helper={account.valuesMasked ? maskedValue : t.brokerSnapshot} />
        <MetricCard label={t.buyingPower} value={accountValue(account.buyingPower)} helper={account.valuesMasked ? maskedValue : t.paperAccount} />
        <MetricCard label={t.positionValue} value={account.valuesMasked ? maskedValue : formatCurrency(totalPositionValue)} helper={`${positions.length} ${t.activePositions}`} />
      </section>

      <section className="health-grid" aria-label={language === 'th' ? 'สรุปพอร์ต' : 'Portfolio summary'}>
        <article className="health-card"><WalletCards aria-hidden="true" /><div><span>{t.positions}</span><strong>{positions.length}</strong></div></article>
        <article className="health-card"><ShieldCheck aria-hidden="true" /><div><span>{t.bracketProtected}</span><strong>{protectedPositions}/{positions.length}</strong></div></article>
        <article className="health-card"><Activity aria-hidden="true" /><div><span>{t.openOrders}</span><strong>{openOrders.length}</strong></div></article>
        <article className="health-card"><Zap aria-hidden="true" /><div><span>{t.curatorSignals}</span><strong>{signals.length}</strong></div></article>
      </section>

      <div className="content-grid">
        <PositionsTable positions={positions} openOrders={openOrders} t={t} />
        <OrdersTable orders={openOrders} t={t} />
      </div>
      <SignalsPanel signals={signals} t={t} />
      <button className="refresh-button" type="button" onClick={() => refresh()} disabled={isRefreshing}>
        <RefreshCw className={isRefreshing ? 'spinning' : ''} aria-hidden="true" /> {t.refresh}
      </button>
    </>
  );
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [activePage, setActivePage] = useState('portfolio');
  const [entries, setEntries] = useState([]);
  const [financeBudgetThb, setFinanceBudgetThb] = useState('0');
  const [tradeBudgetUsd, setTradeBudgetUsd] = useState('0');
  const [operatorToken, setOperatorToken] = useState('');
  const [isControlConnected, setIsControlConnected] = useState(false);
  const [controlStatus, setControlStatus] = useState({ state: 'locked', message: 'ยังไม่ได้เชื่อมต่อ Manager_Agent' });
  const t = useMemo(() => translations[language], [language]);
  const { snapshot, isLoading, isRefreshing, error, lastUpdatedAt, refresh, refreshMs } = useDashboardSnapshot();
  const dashboardSnapshot = snapshot ?? emptyDashboardSnapshot;
  const dataSource = getDashboardDataSource();
  const mockMode = dataSource === DATA_SOURCES.MOCK;
  const managerControlAvailable = dataSource === DATA_SOURCES.MANAGER_API;
  const accountId = '1';

  useEffect(() => {
    window.localStorage.setItem('trading-dashboard-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const loadFinanceState = async () => {
    const response = await getFinanceState({ operatorToken, accountId });
    const state = response.data || {};
    const budgets = state.budgets || {};
    setEntries(Array.isArray(state.entries) ? state.entries : []);
    setFinanceBudgetThb(String(budgets.personal_investment_budget_thb ?? '0'));
    setTradeBudgetUsd(String(budgets.trade_plan_limit_usd ?? '0'));
  };

  const connectControl = async () => {
    if (!managerControlAvailable) return;
    setControlStatus({ state: 'checking', message: 'กำลังตรวจสอบสิทธิ์และโหลดข้อมูล…' });
    setIsControlConnected(false);
    try {
      const response = await getControlCapabilities(operatorToken);
      await loadFinanceState();
      const capabilities = response.data;
      setIsControlConnected(true);
      setControlStatus({
        state: capabilities.execution_enabled ? 'ready' : 'planning',
        message: capabilities.execution_enabled
          ? `เชื่อมต่อแล้ว | ${capabilities.trading_mode} | ยืนยันก่อนส่งคำสั่ง`
          : `เชื่อมต่อแล้ว | ${capabilities.trading_mode} | โหมดวางแผนเท่านั้น`,
      });
    } catch (connectError) {
      setControlStatus({ state: 'error', message: safeRefreshError(connectError, language) });
    }
  };

  const handleOperatorTokenChange = (value) => {
    setOperatorToken(value);
    setIsControlConnected(false);
    setControlStatus({ state: 'locked', message: 'Token เปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่' });
  };

  const handleCreateEntry = async (entry) => {
    const response = await createFinanceEntry({ operatorToken, accountId, entry });
    setEntries((current) => [response.data, ...current.filter((item) => item.entry_id !== response.data.entry_id)]);
  };

  const handleDeleteEntry = async (entryId) => {
    await deleteFinanceEntry({ operatorToken, accountId, entryId });
    setEntries((current) => current.filter((item) => item.entry_id !== entryId));
  };

  const saveBudgets = async () => {
    const response = await updateFinanceBudgets({
      operatorToken,
      accountId,
      personalInvestmentBudgetThb: Number(financeBudgetThb || 0),
      tradePlanLimitUsd: Number(tradeBudgetUsd || 0),
    });
    setFinanceBudgetThb(String(response.data.personal_investment_budget_thb ?? '0'));
    setTradeBudgetUsd(String(response.data.trade_plan_limit_usd ?? '0'));
    setControlStatus((current) => ({ ...current, message: `${current.message.split(' | งบ')[0]} | งบบันทึกแล้ว` }));
  };

  const toggleLanguage = () => setLanguage((current) => (current === 'th' ? 'en' : 'th'));
  const readOnlyMessage = language === 'th'
    ? 'Production อ่าน Snapshot สาธารณะแบบ read-only โดยไม่ต้องเปิด Manager API ตลอดเวลา'
    : 'Production reads a public, read-only snapshot without an always-on Manager API.';

  return (
    <main className="app-shell">
      <div className="top-actions">
        <button className="language-switcher" type="button" onClick={toggleLanguage} aria-label="Switch language">
          <Languages aria-hidden="true" /><span>{language === 'th' ? 'EN' : 'ไทย'}</span>
        </button>
      </div>

      <section className="hero">
        <div>
          <p className="eyebrow">AI finance & trading control center</p>
          <h1>ศูนย์ควบคุมการเงินและ AI Trading</h1>
          <p className="hero-copy">ติดตาม GitHub Actions รายชั่วโมงจาก Snapshot แบบอ่านอย่างเดียว และใช้ Web Control เฉพาะเมื่อมี Manager API</p>
          <div className="refresh-row">
            <span className={`status ${mockMode ? 'warn' : 'good'}`} data-testid="data-source">
              {mockMode ? t.mockMode : `${t.liveMode}: ${dataSource}`}
            </span>
            <span className="sync-text">{t.lastUpdated}: {formatUpdatedAt(lastUpdatedAt || dashboardSnapshot.generatedAt, language, t.notUpdated)}</span>
            <span className="sync-text">{t.autoRefresh}: {Math.round(refreshMs / 1000)}s</span>
          </div>
          {error ? (
            <div className="error-banner" role="alert">
              <span>{t.apiFailed}: {safeRefreshError(error, language)} {snapshot ? t.showingLastSnapshot : t.noSnapshotAvailable}</span>
              <button type="button" onClick={() => refresh()} disabled={isRefreshing}>{language === 'th' ? 'ลองใหม่' : 'Retry'}</button>
            </div>
          ) : null}
        </div>
        <div className="hero-status">
          <span data-testid="trading-mode">{dashboardSnapshot.runtime.mode}</span>
          <strong>{isLoading ? t.loading : dashboardSnapshot.workflow.conclusion}</strong>
          <LockKeyhole aria-hidden="true" />
        </div>
      </section>

      <nav className="control-nav" aria-label="เมนูศูนย์ควบคุม">
        <button className={activePage === 'ledger' ? 'active' : ''} type="button" disabled={!managerControlAvailable} onClick={() => setActivePage('ledger')}><NotebookTabs aria-hidden="true" /> รายรับรายจ่าย</button>
        <button className={activePage === 'advisor' ? 'active' : ''} type="button" disabled={!managerControlAvailable} onClick={() => setActivePage('advisor')}><Bot aria-hidden="true" /> AI การเงิน</button>
        <button className={activePage === 'investment' ? 'active' : ''} type="button" disabled={!managerControlAvailable} onClick={() => setActivePage('investment')}><WalletCards aria-hidden="true" /> AI ลงทุนและคำสั่งเทรด</button>
        <button className={activePage === 'portfolio' ? 'active' : ''} type="button" onClick={() => setActivePage('portfolio')}><Activity aria-hidden="true" /> ภาพรวมระบบ</button>
      </nav>

      {managerControlAvailable ? (
        <section className="operator-bar">
          <label>
            <span>Operator Token ไม่ถูกบันทึกในเบราว์เซอร์</span>
            <input type="password" autoComplete="off" value={operatorToken} onChange={(event) => handleOperatorTokenChange(event.target.value)} placeholder="ใส่ WEB_CONTROL_OPERATOR_TOKEN" />
          </label>
          <button className="primary-action" type="button" onClick={connectControl}>เชื่อมต่อ Manager</button>
          <p className={`status ${controlStatus.state === 'error' ? 'warn' : 'good'}`}>{controlStatus.message}</p>
        </section>
      ) : (
        <section className="read-only-banner" aria-label="Read-only public snapshot mode">
          <ShieldCheck aria-hidden="true" /><p>{readOnlyMessage}</p>
        </section>
      )}

      {activePage === 'ledger' ? <FinanceLedger entries={entries} onCreate={handleCreateEntry} onDelete={handleDeleteEntry} isConnected={isControlConnected} /> : null}
      {activePage === 'advisor' ? <FinanceAdvisor accountId={accountId} operatorToken={operatorToken} availableCapital={financeBudgetThb} onAvailableCapitalChange={setFinanceBudgetThb} onSaveBudget={saveBudgets} isConnected={isControlConnected} /> : null}
      {activePage === 'investment' ? <InvestmentCommandCenter accountId={accountId} operatorToken={operatorToken} snapshot={dashboardSnapshot} t={t} availableCapital={tradeBudgetUsd} onAvailableCapitalChange={setTradeBudgetUsd} onSaveBudget={saveBudgets} isConnected={isControlConnected} /> : null}
      {activePage === 'portfolio' ? (
        <PortfolioOverview snapshot={dashboardSnapshot} language={language} t={t} isLoading={isLoading} isRefreshing={isRefreshing} refresh={refresh} />
      ) : null}

      <p className="schema-version" data-testid="schema-version">{dashboardSnapshot.schemaVersion} · web-control.v1</p>
    </main>
  );
}
