import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Gauge,
  Languages,
  NotebookTabs,
  RefreshCw,
  WalletCards,
  Zap,
} from 'lucide-react';
import AppNavigation from './components/AppNavigation.jsx';
import HourlyAutomationStatus from './components/HourlyAutomationStatus.jsx';
import { DATA_SOURCES } from './config/dashboardConfig.js';
import { emptyDashboardSnapshot } from './data/emptyDashboard.js';
import OverviewPage from './features/dashboard/OverviewPage.jsx';
import PortfolioPage from './features/portfolio/PortfolioPage.jsx';
import { useDashboardSnapshot } from './hooks/useDashboardSnapshot.js';
import { useRouteNavigation } from './hooks/useRouteNavigation.js';
import { getInitialLanguage, translations } from './i18n.js';
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getControlCapabilities,
  getFinanceState,
  updateFinanceBudgets,
} from './services/controlApi.js';
import { getDashboardDataSource } from './services/api.js';
import { isManagerControlPage } from './routes/routeConfig.js';
import { formatBangkokDateTime } from './utils/dateTime.js';

const FinanceAdvisor = lazy(() => import('./components/FinanceAdvisor.jsx'));
const FinanceLedger = lazy(() => import('./components/FinanceLedger.jsx'));
const InvestmentCommandCenter = lazy(() => import('./components/InvestmentCommandCenter.jsx'));

function safeRefreshError(error, language) {
  const fallback = language === 'th' ? 'โหลด Snapshot ไม่สำเร็จ' : 'Snapshot refresh failed';
  const message = typeof error?.message === 'string' ? error.message : fallback;
  const printable = Array.from(message, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
}

export default function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
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

  const { activePage: resolvedActivePage, navigateToPage } = useRouteNavigation(navigationItems);
  const activePageMeta = navigationItems.find((item) => item.id === resolvedActivePage) ?? navigationItems[0];
  const managerPageActive = isManagerControlPage(resolvedActivePage);

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
      collapseLabel={t.collapseNavigation}
      expandLabel={t.expandNavigation}
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
            <span className="sync-text">{t.lastUpdated}: {formatBangkokDateTime(lastUpdatedAt || dashboardSnapshot.generatedAt, language, t.notUpdated)}</span>
            <span className="sync-text">{t.autoRefresh}: {Math.round(refreshMs / 1000)}s</span>
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <span>{t.apiFailed}: {safeRefreshError(error, language)} {snapshot ? t.showingLastSnapshot : t.noSnapshotAvailable}</span>
              <button type="button" onClick={() => refresh()} disabled={isRefreshing}>{t.retry}</button>
            </div>
          ) : null}
        </header>

        {managerControlAvailable && managerPageActive ? (
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
        {managerPageActive ? (
          <Suspense fallback={<div className="panel" role="status" aria-live="polite">{t.loading}</div>}>
            {resolvedActivePage === 'ledger' ? <FinanceLedger entries={entries} onCreate={handleCreateEntry} onDelete={handleDeleteEntry} isConnected={isControlConnected} /> : null}
            {resolvedActivePage === 'advisor' ? <FinanceAdvisor accountId={accountId} operatorToken={operatorToken} availableCapital={financeBudgetThb} onAvailableCapitalChange={setFinanceBudgetThb} onSaveBudget={saveBudgets} isConnected={isControlConnected} /> : null}
            {resolvedActivePage === 'investment' ? <InvestmentCommandCenter accountId={accountId} operatorToken={operatorToken} snapshot={dashboardSnapshot} t={t} availableCapital={tradeBudgetUsd} onAvailableCapitalChange={setTradeBudgetUsd} onSaveBudget={saveBudgets} isConnected={isControlConnected} /> : null}
          </Suspense>
        ) : null}

        <p className="schema-version" data-testid="schema-version">{dashboardSnapshot.schemaVersion} · web-control.v1</p>
      </main>
    </AppNavigation>
  );
}
