import { Download, FileSpreadsheet, Grid2X2, Search, TableProperties } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import OrdersTable from '../../components/OrdersTable.jsx';
import PortfolioActionCenter from '../../components/PortfolioActionCenter.jsx';
import PositionsTable from '../../components/PositionsTable.jsx';
import SignalsPanel from '../../components/SignalsPanel.jsx';
import {
  createPortfolioExport,
  derivePortfolioWorkspace,
  PORTFOLIO_PAGE_SIZE,
} from '../../utils/portfolio.js';
import { downloadClientFile } from '../../utils/spreadsheet.js';
import PositionDetailDrawer from './PositionDetailDrawer.jsx';

function initialViewMode() {
  return typeof window !== 'undefined' && window.innerWidth <= 700 ? 'cards' : 'table';
}

export default function PortfolioPage({ snapshot, t }) {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState('all');
  const [protection, setProtection] = useState('all');
  const [sort, setSort] = useState('symbol');
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [page, setPage] = useState(1);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [exportStatus, setExportStatus] = useState('');
  const signals = snapshot.signals ?? snapshot.curatorSignals ?? [];
  const valuesMasked = Boolean(snapshot.account?.valuesMasked || snapshot.privacy?.valuesMasked);
  const workspace = useMemo(() => derivePortfolioWorkspace({
    positions: snapshot.positions,
    openOrders: snapshot.openOrders,
    query,
    bucket,
    protection,
    sort,
    page,
    pageSize: PORTFOLIO_PAGE_SIZE,
    valuesMasked,
  }), [bucket, page, protection, query, snapshot.openOrders, snapshot.positions, sort, valuesMasked]);
  const selectedPosition = workspace.allPositions.find(
    (position) => position.symbol === selectedSymbol,
  );
  const selectedOrder = snapshot.openOrders.find((order) => order.symbol === selectedSymbol);

  useEffect(() => {
    if (!exportStatus) return undefined;
    const timer = window.setTimeout(() => setExportStatus(''), 4_000);
    return () => window.clearTimeout(timer);
  }, [exportStatus]);

  const resetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const closePositionDetail = useCallback(() => setSelectedSymbol(null), []);
  const clearFilters = () => {
    setQuery('');
    setBucket('all');
    setProtection('all');
    setPage(1);
  };
  const exportPositions = (format) => {
    if (workspace.allPositions.length === 0) return;
    const file = createPortfolioExport({
      positions: workspace.allPositions,
      openOrders: snapshot.openOrders,
      format,
      valuesMasked,
      labels: {
        symbol: t.symbol,
        bucket: t.bucket,
        quantity: t.qty,
        averageCost: t.avg,
        currentPrice: t.current,
        marketValue: t.marketValue,
        pnl: t.pnl,
        protection: t.protection,
        masked: t.masked,
        protected: t.protected,
        needsReview: t.needsReview,
      },
    });
    const snapshotDate = String(snapshot.generatedAt || '').slice(0, 10) || 'snapshot';
    const filename = downloadClientFile(file, `portfolio-${snapshotDate}.${file.extension}`);
    setExportStatus(`${t.exportReady}: ${filename}`);
  };

  const hasFilters = Boolean(query || bucket !== 'all' || protection !== 'all');
  const start = workspace.totalCount
    ? ((workspace.page - 1) * PORTFOLIO_PAGE_SIZE) + 1
    : 0;
  const end = Math.min(workspace.page * PORTFOLIO_PAGE_SIZE, workspace.totalCount);

  return (
    <div className="page-stack" data-testid="page-portfolio">
      <PortfolioActionCenter
        positions={snapshot.positions}
        openOrders={snapshot.openOrders}
        t={t}
      />

      {snapshot.positions.length ? (
        <section className="panel portfolio-toolbar" aria-label={t.portfolioTools}>
          <label className="portfolio-search">
            <span className="sr-only">{t.searchPositions}</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={resetPage(setQuery)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPositions}
            />
          </label>

          <label className="portfolio-select">
            <span>{t.bucketFilter}</span>
            <select value={bucket} onChange={resetPage(setBucket)}>
              <option value="all">{t.allBuckets}</option>
              {workspace.buckets.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>

          <label className="portfolio-select">
            <span>{t.protectionFilter}</span>
            <select value={protection} onChange={resetPage(setProtection)}>
              <option value="all">{t.allProtection}</option>
              <option value="protected">{t.protectedOnly}</option>
              <option value="review">{t.reviewOnly}</option>
            </select>
          </label>

          <label className="portfolio-select">
            <span>{t.sortPositions}</span>
            <select value={sort} onChange={resetPage(setSort)}>
              <option value="symbol">{t.sortSymbolAsc}</option>
              <option value="market-value">{t.sortValueDesc}</option>
              <option value="pnl">{t.sortPnlDesc}</option>
            </select>
          </label>

          <div className="portfolio-view-toggle" role="group" aria-label={t.positionView}>
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              aria-label={t.tableView}
              title={t.tableView}
            >
              <TableProperties aria-hidden="true" />
              <span>{t.tableView}</span>
            </button>
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              aria-label={t.cardView}
              title={t.cardView}
            >
              <Grid2X2 aria-hidden="true" />
              <span>{t.cardView}</span>
            </button>
          </div>

          <div className="portfolio-export-actions" role="group" aria-label={t.exportPositions}>
            <button
              type="button"
              onClick={() => exportPositions('csv')}
              disabled={!workspace.totalCount}
              aria-label={t.exportCsv}
            >
              <Download aria-hidden="true" />
              <span>{t.exportCsv}</span>
            </button>
            <button
              type="button"
              onClick={() => exportPositions('excel')}
              disabled={!workspace.totalCount}
              aria-label={t.exportExcel}
            >
              <FileSpreadsheet aria-hidden="true" />
              <span>{t.exportExcel}</span>
            </button>
          </div>
        </section>
      ) : null}

      {snapshot.positions.length ? (
        <div className="portfolio-result-summary" aria-live="polite">
          <span>{t.showingPositions} {start}–{end} {t.of} {workspace.totalCount}</span>
          {hasFilters ? <button type="button" onClick={clearFilters}>{t.clearFilters}</button> : null}
        </div>
      ) : null}

      <div className="portfolio-position-workspace">
        <PositionsTable
          positions={workspace.positions}
          openOrders={snapshot.openOrders}
          t={t}
          showActionCenter={false}
          viewMode={viewMode}
          totalCount={workspace.totalCount}
          emptyTitle={snapshot.positions.length === 0 ? t.noPositionsTitle : t.noPositionMatches}
          emptyDescription={snapshot.positions.length === 0
            ? t.noPositionsDescription
            : t.noPositionMatchesDescription}
          onViewDetails={(position) => setSelectedSymbol(position.symbol)}
        />
        {workspace.pageCount > 1 ? (
          <nav className="portfolio-pagination" aria-label={t.portfolioPagination}>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={workspace.page === 1}
              aria-label={t.previousPage}
            >
              <span>{t.previous}</span>
            </button>
            <span>{t.page} {workspace.page} {t.of} {workspace.pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(workspace.pageCount, current + 1))}
              disabled={workspace.page === workspace.pageCount}
              aria-label={t.nextPage}
            >
              <span>{t.next}</span>
            </button>
          </nav>
        ) : null}
      </div>

      <div className="portfolio-secondary-grid">
        <OrdersTable orders={snapshot.openOrders} t={t} />
        <SignalsPanel signals={signals} t={t} />
      </div>

      {exportStatus ? <div className="portfolio-toast" role="status">{exportStatus}</div> : null}
      {selectedPosition ? (
        <PositionDetailDrawer
          position={selectedPosition}
          order={selectedOrder}
          t={t}
          onClose={closePositionDetail}
        />
      ) : null}
    </div>
  );
}
