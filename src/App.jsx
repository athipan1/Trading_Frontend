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
import InvestmentCommandCenter from './components/InvestmentCommandCenter.jsx';
import MetricCard from './components/MetricCard.jsx';
import OrdersTable from './components/OrdersTable.jsx';
import PositionsTable from './components/PositionsTable.jsx';
import SignalsPanel from './components/SignalsPanel.jsx';
import { DATA_SOURCES } from './config/dashboardConfig.js';
import { emptyDashboardSnapshot } from './data/emptyDashboard.js';
import { useDashboardSnapshot } from './hooks/useDashboardSnapshot.js';
import { getInitialLanguage, translations } from './i18n.js';
import { getControlCapabilities } from './services/controlApi.js';
import { getDashboardDataSource } from './services/api.js';
import { formatCurrency } from './utils/formatters.js';

const LEDGER_KEY = 'trading-control-finance-ledger.v1';
const FINANCE_BUDGET_THB_KEY = 'trading-control-finance-budget-thb.v1';
const TRADE_BUDGET_USD_KEY = 'trading-control-trade-budget-usd.v1';

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function formatUpdatedAt(value, language, fallback) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function PortfolioOverview({ snapshot, t, isLoading, isRefreshing, refresh }) {
  const { account, positions, openOrders, curatorSignals } = snapshot;
  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const protectedPositions = positions.filter((position) =>
    openOrders.some((order) => order.symbol === position.symbol && order.orderClass === 'bracket'),
  ).length;

  return (
    <>
      <section className="metrics-grid">
        <MetricCard label={t.cash} value={formatCurrency(account.cash)} helper={t.availableBalance} tone="cash" />
        <MetricCard label={t.equity} value={formatCurrency(account.equity)} helper={t.brokerSnapshot} />
        <MetricCard label={t.buyingPower} value={formatCurrency(account.buyingPower)} helper={t.paperAccount} />
        <MetricCard label={t.positionValue} value={formatCurrency(totalPositionValue)} helper={`${positions.length} ${t.activePositions}`} />
      </section>

      <section className="health-grid">
        <article className="health-card"><WalletCards /><div><span>{t.positions}</span><strong>{positions.length}</strong></div></article>
        <article className="health-card"><ShieldCheck /><div><span>{t.bracketProtected}</span><strong>{protectedPositions}/{positions.length}</strong></div></article>
        <article className="health-card"><Activity /><div><span>{t.openOrders}</span><strong>{openOrders.length}</strong></div></article>
        <article className="health-card"><Zap /><div><span>{t.curatorSignals}</span><strong>{curatorSignals.length}</strong></div></article>
      </section>

      <div className="content-grid">
        <PositionsTable positions={positions} openOrders={openOrders} t={t} />
        <OrdersTable orders={openOrders} t={t} />
      </div>
      <SignalsPanel signals={curatorSignals} t={t} />
      {isLoading ? <p className="hint">{t.loading}</p> : null}
      <button className="refresh-button" type="button" onClick={() => refresh()} disabled={isRefreshing}>
        <RefreshCw className={isRefreshing ? 'spinning' : ''} /> {t.refresh}
      </button>
    </>
  );
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [activePage, setActivePage] = useState('ledger');
  const [entries, setEntries] = useState(() => readJson(LEDGER_KEY, []));
  const [financeBudgetThb, setFinanceBudgetThb] = useState(() => window.localStorage.getItem(FINANCE_BUDGET_THB_KEY) || '0');
  const [tradeBudgetUsd, setTradeBudgetUsd] = useState(() => window.localStorage.getItem(TRADE_BUDGET_USD_KEY) || '0');
  const [operatorToken, setOperatorToken] = useState('');
  const [controlStatus, setControlStatus] = useState({ state: 'locked', message: 'ยังไม่ได้เชื่อมต่อ Manager_Agent' });
  const t = useMemo(() => translations[language], [language]);
  const { snapshot, isLoading, isRefreshing, error, lastUpdatedAt, refresh, refreshMs } = useDashboardSnapshot();
  const dashboardSnapshot = snapshot ?? emptyDashboardSnapshot;
  const dataSource = getDashboardDataSource();
  const mockMode = dataSource === DATA_SOURCES.MOCK;
  const accountId = '1';

  useEffect(() => {
    window.localStorage.setItem('trading-dashboard-language', language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    window.localStorage.setItem(FINANCE_BUDGET_THB_KEY, financeBudgetThb);
  }, [financeBudgetThb]);

  useEffect(() => {
    window.localStorage.setItem(TRADE_BUDGET_USD_KEY, tradeBudgetUsd);
  }, [tradeBudgetUsd]);

  const connectControl = async () => {
    setControlStatus({ state: 'checking', message: 'กำลังตรวจสอบสิทธิ์…' });
    try {
      const response = await getControlCapabilities(operatorToken);
      const capabilities = response.data;
      setControlStatus({
        state: capabilities.execution_enabled ? 'ready' : 'planning',
        message: capabilities.execution_enabled
          ? `เชื่อมต่อแล้ว | ${capabilities.trading_mode} | ยืนยันก่อนส่งคำสั่ง`
          : `เชื่อมต่อแล้ว | ${capabilities.trading_mode} | โหมดวางแผนเท่านั้น`,
      });
    } catch (connectError) {
      setControlStatus({ state: 'error', message: connectError.message });
    }
  };

  const toggleLanguage = () => setLanguage((current) => (current === 'th' ? 'en' : 'th'));

  return (
    <main className="app-shell">
      <div className="top-actions">
        <button className="language-switcher" type="button" onClick={toggleLanguage} aria-label="Switch language">
          <Languages /><span>{language === 'th' ? 'EN' : 'ไทย'}</span>
        </button>
      </div>

      <section className="hero">
        <div>
          <p className="eyebrow">AI finance & trading control center</p>
          <h1>ศูนย์ควบคุมการเงินและ AI Trading</h1>
          <p className="hero-copy">บันทึกกระแสเงินสด วางแผนกับ AI และส่งคำสั่งผ่าน Manager_Agent หลังผู้ใช้ยืนยันเท่านั้น</p>
          <div className="refresh-row">
            <span className={`status ${mockMode ? 'warn' : 'good'}`} data-testid="data-source">
              {mockMode ? t.mockMode : `${t.liveMode}: ${dataSource}`}
            </span>
            <span className="sync-text">{t.lastUpdated}: {formatUpdatedAt(lastUpdatedAt || dashboardSnapshot.account.lastSyncedAt, language, t.notUpdated)}</span>
            <span className="sync-text">{t.autoRefresh}: {Math.round(refreshMs / 1000)}s</span>
          </div>
          {error ? <p className="error-banner" role="alert">{t.apiFailed}: {error.message}</p> : null}
        </div>
        <div className="hero-status">
          <span data-testid="trading-mode">{dashboardSnapshot.account.mode}</span>
          <strong>{isLoading ? t.loading : dashboardSnapshot.account.status}</strong>
          <LockKeyhole />
        </div>
      </section>

      <nav className="control-nav" aria-label="เมนูศูนย์ควบคุม">
        <button className={activePage === 'ledger' ? 'active' : ''} type="button" onClick={() => setActivePage('ledger')}><NotebookTabs /> รายรับรายจ่าย</button>
        <button className={activePage === 'advisor' ? 'active' : ''} type="button" onClick={() => setActivePage('advisor')}><Bot /> AI การเงิน</button>
        <button className={activePage === 'investment' ? 'active' : ''} type="button" onClick={() => setActivePage('investment')}><WalletCards /> AI ลงทุนและคำสั่งเทรด</button>
        <button className={activePage === 'portfolio' ? 'active' : ''} type="button" onClick={() => setActivePage('portfolio')}><Activity /> ภาพรวมระบบ</button>
      </nav>

      <section className="operator-bar">
        <label>
          <span>Operator Token ไม่ถูกบันทึกในเบราว์เซอร์</span>
          <input type="password" autoComplete="off" value={operatorToken} onChange={(event) => setOperatorToken(event.target.value)} placeholder="ใส่ WEB_CONTROL_OPERATOR_TOKEN" />
        </label>
        <button className="primary-action" type="button" onClick={connectControl}>เชื่อมต่อ Manager</button>
        <p className={`status ${controlStatus.state === 'error' ? 'warn' : 'good'}`}>{controlStatus.message}</p>
      </section>

      {activePage === 'ledger' ? <FinanceLedger entries={entries} onChange={setEntries} /> : null}
      {activePage === 'advisor' ? (
        <FinanceAdvisor
          accountId={accountId}
          operatorToken={operatorToken}
          entries={entries}
          availableCapital={financeBudgetThb}
          onAvailableCapitalChange={setFinanceBudgetThb}
        />
      ) : null}
      {activePage === 'investment' ? (
        <InvestmentCommandCenter
          accountId={accountId}
          operatorToken={operatorToken}
          snapshot={dashboardSnapshot}
          t={t}
          availableCapital={tradeBudgetUsd}
          onAvailableCapitalChange={setTradeBudgetUsd}
        />
      ) : null}
      {activePage === 'portfolio' ? (
        <PortfolioOverview
          snapshot={dashboardSnapshot}
          t={t}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          refresh={refresh}
        />
      ) : null}

      <p className="schema-version" data-testid="schema-version">{dashboardSnapshot.schemaVersion} · web-control.v1</p>
    </main>
  );
}
