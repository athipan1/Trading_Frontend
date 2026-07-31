import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  ChevronRight,
  Gauge,
  Languages,
  NotebookTabs,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Zap,
} from 'lucide-react';
import AppNavigation from './components/AppNavigation.jsx';
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

const PAGE_PATHS = {
  overview: '/overview',
  portfolio: '/portfolio',
  system: '/system',
  ledger: '/ledger',
  advisor: '/advisor',
  investment: '/investment',
};

function pageFromPath(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/') return 'overview';
  return Object.entries(PAGE_PATHS).find(([, path]) => path === normalized)?.[0] || 'overview';
}

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
  const printable = Array.from(message, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
}

function AccountMetrics({ snapshot, language, t }) {
  const { account, positions } = snapshot;
  const totalPositionValue = positions.reduce((sum, position) => sum + Number(position.marketValue || 0), 0);
  const maskedValue = language === 'th' ? 'ปกปิด' : 'Masked';
  const accountValue = (value) => (account.valuesMasked || value === null ? maskedValue : formatCurrency(value));

  return (
    <section className="metrics-grid" aria-label={language === 'th' ? 'ข้อมูลบัญชี' : 'Account metrics'}>
      <MetricCard label={t.cash} value={accountValue(account.cash)} helper={account.valuesMasked ? maskedValue : t.availableBalance} tone="cash" />
      <MetricCard label={t.equity} value={accountValue(account.equity)} helper={account.valuesMasked ? maskedValue : t.brokerSnapshot} />
      <MetricCard label={t.buyingPower} value={accountValue(account.buyingPower)} helper={account.valuesMasked ? maskedValue : t.paperAccount} />
      <MetricCard label={t.positionValue} value={account.valuesMasked ? maskedValue : formatCurrency(totalPositionValue)} helper={`${positions.length} ${t.activePositions}`} />
    </section>
  );
}

function PortfolioHealth({ snapshot, t }) {
  const { positions, openOrders } = snapshot;
  const signals = snapshot.signals ?? snapshot.curatorSignals ?? [];
  const protectedPositions = positions.filter((position) =>
    openOrders.some((order) => order.symbol === position.symbol && order.orderClass === 'bracket'),
  ).length;

  return (
    <section className="health-grid" aria-label={t.portfolioSummary}>
      <article className="health-card"><WalletCards aria-hidden="true" /><div><span>{t.positions}</span><strong>{positions.length}</strong></div></article>
      <article className="health-card"><ShieldCheck aria-hidden="true" /><div><span>{t.bracketProtected}</span><strong>{protectedPositions}/{positions.length}</strong></div></article>
      <article className="health-card"><Activity aria-hidden="true" /><div><span>{t.openOrders}</span><strong>{openOrders.length}</strong></div></article>
      <article className="health-card"><Zap aria-hidden="true" /><div><span>{t.curatorSignals}</span><strong>{signals.length}</strong></div></article>
    </section>
  );
}

function SystemSummary({ snapshot, language, t, onOpenSystem, onOpenPortfolio }) {
  const conclusion = snapshot.workflow?.conclusion || 'unknown';
  const isHealthy = conclusion === 'success' || conclusion === 'completed';
  const generatedAt = snapshot.generatedAt;

  return (
    <section className={`panel overview-system-card${isHealthy ? ' healthy' : ' attention'}`}>
      <div className="overview-system-copy">
        <span className={`status ${isHealthy ? 'good' : 'warn'}`}>
          <ShieldCheck aria-hidden="true" /> {isHealthy ? t.systemHealthy : t.systemNeedsAttention}
        </span>
        <h2>{t.latestAutomation}</h2>
        <p>{t.latestAutomationDescription}</p>
      </div>
      <div className="overview-system-facts">
        <div><span>{t.workflowStatus}</span><strong>{conclusion}</strong></div>
        <div><span>{t.runtimeMode}</span><strong>{snapshot.runtime?.mode || 'UNKNOWN'}</strong></div>
        <div><span>{t.lastUpdated}</span><strong>{formatUpdatedAt(generatedAt, language, t.notUpdated)}</strong></div>
      </div>
      <div className="overview-quick-actions">
        <button className="secondary-action" type="button" onClick={onOpenPortfolio}>
          {t.openPortfolio}<ChevronRight aria-hidden="true" />
        </button>
        <button className="primary-action" type="button" onClick={onOpenSystem}>
          {t.viewSystemDetails}<ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function OverviewPage({ snapshot, language, t, onNavigate, readOnlyMessage }) {
  return (
    <div className="page-stack" data-testid="page-overview">
      <SystemSummary
        snapshot={snapshot}
        language={language}
        t={t}
        onOpenSystem={() => onNavigate('system')}
        onOpenPortfolio={() => onNavigate('portfolio')}
      />
      <AccountMetrics snapshot={snapshot} language={language} t={t} />
      <PortfolioHealth snapshot={snapshot} t={t} />
      {readOnlyMessage ? (
        <section className="read-only-banner" aria-label="Read-only public snapshot mode">
          <ShieldCheck aria-hidden="true" /><p>{readOnlyMessage}</p>
        </section>
      ) : null}
    </div>
  );
}

function PortfolioPage({ snapshot, t }) {
  const signals = snapshot.signals ?? snapshot.curatorSignals ?? [];

  return (
    <div className="page-stack" data-testid="page-portfolio">
      <div className="content-grid">
        <PositionsTable positions={snapshot.positions} openOrders={snapshot.openOrders} t={t} />
        <OrdersTable orders={snapshot.openOrders} t={t} />
      </div>
      <SignalsPanel signals={signals} t={t} />
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [activePage, setActivePage] = useState(() => pageFromPath(window.location.pathname));
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

  const navigationItems = useMemo(() => {
    const publicItems = [
      { id: 'overview', label: t.navOverview, description: t.navOverviewDescription, icon: Gauge },
      { id: 'portfolio', label: t.navPortfolio, description: t.navPortfolioDescription, icon: WalletCards },
      { id: 'system', label: t.navSystem, description: t.navSystemDescription, icon: Activity },
    ];
    if (!managerControlAvailable) return publicItems;
    return [
      ...publicItems,
      { id: 'ledger', label: t.navLedger, description: t.navLedgerDescription, icon: NotebookTabs },
      { id: 'advisor', label: t.navAdvisor, description: t.navAdvisorDescription, icon: Bot },
      { id: 'investment', label: t.navInvestment, description: t.navInvestmentDescription, icon: Zap },
    ];
  }, [managerControlAvailable, t]);

  const resolvedActivePage = navigationItems.some((item) => item.id === activePage) ? activePage : 'overview';
  const activePageMeta = navigationItems.find((item) => item.id === resolvedActivePage) ?? navigationItems[0];
  const isManagerControlPage = ['ledger', 'advisor', 'investment'].includes(resolvedActivePage);

  useEffect(() => {
    window.localStorage.setItem('trading-dashboard-language', language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const onPopState = () => setActivePage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (activePage === resolvedActivePage) return;
    window.history.replaceState({}, '', PAGE_PATHS.overview);
  }, [activePage, resolvedActivePage]);

  const navigateToPage = (page) => {
    if (!navigationItems.some((item) => item.id === page)) return;
    setActivePage(page);
    window.history.pushState({}, '', PAGE_PATHS[page]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
  const readOnlyMessage = managerControlAvailable ? null : t.readOnlySnapshotMessage;

  return (
    <AppNavigation
      items={navigationItems}
      activePage={resolvedActivePage}
      onNavigate={navigateToPage}
      brand={{
        title: t.appName,
        subtitle: t.appTagline,
        navigationLabel: t.mainNavigation,
        closeLabel: t.close,
      }}
      boundaryLabel={t.paperBoundary}
      moreLabel={t.navMore}
    >
      <main className="app-shell">
        <header className="dashboard-header">
          <div className="dashboard-heading">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{activePageMeta.label}</h1>
            <p>{activePageMeta.description}</p>
          </div>

          <div className="dashboard-header-actions">
            <button className="language-switcher" type="button" onClick={toggleLanguage} aria-label="Switch language">
              <Languages aria-hidden="true" /><span>{language === 'th' ? 'EN' : 'ไทย'}</span>
            </button>
            <button className="header-refresh-button" type="button" onClick={() => refresh()} disabled={isRefreshing} aria-label={t.refreshNow}>
              <RefreshCw className={isRefreshing ? 'spinning' : ''} aria-hidden="true" />
              <span>{t.refresh}</span>
            </button>
          </div>

          <div className="dashboard-status-row">
            <span className={`status ${mockMode ? 'warn' : 'good'}`} data-testid="data-source">
              {mockMode ? t.mockMode : `${t.liveMode}: ${dataSource}`}
            </span>
            <span className="status neutral-status" data-testid="trading-mode">{dashboardSnapshot.runtime.mode}</span>
            <span className="sync-text">{t.lastUpdated}: {formatUpdatedAt(lastUpdatedAt || dashboardSnapshot.generatedAt, language, t.notUpdated)}</span>
            <span className="sync-text">{t.autoRefresh}: {Math.round(refreshMs / 1000)}s</span>
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <span>{t.apiFailed}: {safeRefreshError(error, language)} {snapshot ? t.showingLastSnapshot : t.noSnapshotAvailable}</span>
              <button type="button" onClick={() => refresh()} disabled={isRefreshing}>{t.retry}</button>
            </div>
          ) : null}
        </header>

        {managerControlAvailable && isManagerControlPage ? (
          <section className="operator-bar">
            <label>
              <span>Operator Token ไม่ถูกบันทึกในเบราว์เซอร์</span>
              <input type="password" autoComplete="off" value={operatorToken} onChange={(event) => handleOperatorTokenChange(event.target.value)} placeholder="ใส่ WEB_CONTROL_OPERATOR_TOKEN" />
            </label>
            <button className="primary-action" type="button" onClick={connectControl}>เชื่อมต่อ Manager</button>
            <p className={`status ${controlStatus.state === 'error' ? 'warn' : 'good'}`}>{controlStatus.message}</p>
          </section>
        ) : null}

        {resolvedActivePage === 'overview' ? (
          <OverviewPage
            snapshot={dashboardSnapshot}
            language={language}
            t={t}
            onNavigate={navigateToPage}
            readOnlyMessage={readOnlyMessage}
          />
        ) : null}
        {resolvedActivePage === 'portfolio' ? <PortfolioPage snapshot={dashboardSnapshot} t={t} /> : null}
        {resolvedActivePage === 'system' ? (
          <HourlyAutomationStatus
            snapshot={dashboardSnapshot}
            language={language}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
            showRefreshAction={false}
          />
        ) : null}
        {resolvedActivePage === 'ledger' ? <FinanceLedger entries={entries} onCreate={handleCreateEntry} onDelete={handleDeleteEntry} isConnected={isControlConnected} /> : null}
        {resolvedActivePage === 'advisor' ? <FinanceAdvisor accountId={accountId} operatorToken={operatorToken} availableCapital={financeBudgetThb} onAvailableCapitalChange={setFinanceBudgetThb} onSaveBudget={saveBudgets} isConnected={isControlConnected} /> : null}
        {resolvedActivePage === 'investment' ? <InvestmentCommandCenter accountId={accountId} operatorToken={operatorToken} snapshot={dashboardSnapshot} t={t} availableCapital={tradeBudgetUsd} onAvailableCapitalChange={setTradeBudgetUsd} onSaveBudget={saveBudgets} isConnected={isControlConnected} /> : null}

        <p className="schema-version" data-testid="schema-version">{dashboardSnapshot.schemaVersion} · web-control.v1</p>
      </main>
    </AppNavigation>
  );
}
