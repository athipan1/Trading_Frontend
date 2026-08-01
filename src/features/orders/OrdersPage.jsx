import {
  ArchiveX,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  ListOrdered,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import { formatBangkokDateTime } from '../../utils/dateTime.js';
import { formatCurrency } from '../../utils/formatters.js';
import {
  createOrdersExport,
  deriveOrdersWorkspace,
  ORDER_PAGE_SIZE,
  orderTimelineEvents,
} from '../../utils/orders.js';
import { downloadClientFile } from '../../utils/spreadsheet.js';

const STATUS_ICONS = Object.freeze({
  pending: Clock3,
  filled: CheckCircle2,
  rejected: ShieldAlert,
  cancelled: XCircle,
  other: Clock3,
});

function financialValue(order, value, t, formatter = String) {
  return order.valuesMasked || value === null ? t.masked : formatter(value);
}

function StatusBadge({ order, t }) {
  const Icon = STATUS_ICONS[order.statusGroup] ?? Clock3;
  return (
    <span className={`order-status-badge ${order.statusGroup}`}>
      <Icon aria-hidden="true" />
      <span>{t.orderStatusGroups[order.statusGroup] ?? t.orderStatusGroups.other}</span>
      <small>{order.status}</small>
    </span>
  );
}

function OrderCards({ orders, generatedAt, language, t }) {
  return (
    <div className="order-management-cards" data-testid="order-card-view">
      {orders.map((order) => (
        <article className="order-management-card" key={`${order.id || order.symbol}-${order.sourceIndex}`}>
          <div className="order-management-card-heading">
            <div>
              <strong>{order.symbol}</strong>
              <span>{order.side}</span>
            </div>
            <StatusBadge order={order} t={t} />
          </div>
          <dl>
            <div><dt>{t.qty}</dt><dd>{financialValue(order, order.quantity, t)}</dd></div>
            <div><dt>{t.orderType}</dt><dd>{order.type}</dd></div>
            <div><dt>{t.orderClass}</dt><dd>{order.orderClass}</dd></div>
            <div><dt>{t.takeProfit}</dt><dd>{financialValue(order, order.takeProfit, t, formatCurrency)}</dd></div>
            <div><dt>{t.stopLoss}</dt><dd>{order.stopLoss ? t.yes : t.no}</dd></div>
            <div>
              <dt>{t.orderObservedAt}</dt>
              <dd>{formatBangkokDateTime(generatedAt, language, t.notUpdated)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function OrderTable({ orders, generatedAt, language, t }) {
  return (
    <div
      className="order-management-table-wrap"
      data-testid="order-table-view"
      role="region"
      aria-label={t.orderTableScroll}
      tabIndex="0"
    >
      <table className="order-management-table">
        <thead>
          <tr>
            <th scope="col">{t.symbol}</th>
            <th scope="col">{t.orderStatus}</th>
            <th scope="col">{t.orderSide}</th>
            <th scope="col">{t.qty}</th>
            <th scope="col">{t.orderType}</th>
            <th scope="col">{t.orderClass}</th>
            <th scope="col">{t.takeProfit}</th>
            <th scope="col">{t.stopLoss}</th>
            <th scope="col">{t.orderObservedAt}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={`${order.id || order.symbol}-${order.sourceIndex}`}>
              <td><strong>{order.symbol}</strong></td>
              <td><StatusBadge order={order} t={t} /></td>
              <td>{order.side}</td>
              <td>{financialValue(order, order.quantity, t)}</td>
              <td>{order.type}</td>
              <td>{order.orderClass}</td>
              <td>{financialValue(order, order.takeProfit, t, formatCurrency)}</td>
              <td>{order.stopLoss ? t.yes : t.no}</td>
              <td>{formatBangkokDateTime(generatedAt, language, t.notUpdated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTimeline({ orders, generatedAt, language, t }) {
  return (
    <section className="panel order-timeline" aria-labelledby="order-timeline-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.orderTimelineEyebrow}</p>
          <h2 id="order-timeline-heading">{t.orderTimeline}</h2>
        </div>
        <span className="pill">{t.readOnly}</span>
      </div>
      <p className="order-timeline-scope">{t.orderTimelineScope}</p>
      {orders.length ? (
        <div
          className="order-timeline-scroll"
          role="region"
          aria-label={t.orderTimelineScroll}
          tabIndex="0"
        >
          <ol className="order-timeline-list">
            {orders.flatMap((order) => orderTimelineEvents(order, generatedAt).map((event, index) => (
              <li key={`${order.id || order.symbol}-${event.kind}-${event.at}-${index}`}>
                <span className={`order-timeline-marker ${order.statusGroup}`} aria-hidden="true" />
                <div>
                  <div className="order-timeline-heading">
                    <strong>{order.symbol}</strong>
                    <span>{t.orderTimelineEvents[event.kind]}</span>
                  </div>
                  <p>{event.kind === 'observed' ? `${t.orderStatus}: ${order.status}` : `${order.side} · ${order.type}`}</p>
                  <time dateTime={event.at}>{formatBangkokDateTime(event.at, language, t.notUpdated)}</time>
                </div>
              </li>
            )))}
          </ol>
        </div>
      ) : (
        <EmptyState
          icon={ArchiveX}
          title={t.noOrderTimelineTitle}
          description={t.noOrderTimelineDescription}
          testId="order-timeline-empty-state"
        />
      )}
    </section>
  );
}

export default function OrdersPage({ snapshot, language, t }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [side, setSide] = useState('all');
  const [sort, setSort] = useState('status');
  const [page, setPage] = useState(1);
  const [exportStatus, setExportStatus] = useState('');
  const valuesMasked = Boolean(snapshot.account?.valuesMasked || snapshot.privacy?.valuesMasked);
  const workspace = useMemo(() => deriveOrdersWorkspace({
    orders: snapshot.openOrders,
    query,
    status,
    side,
    sort,
    page,
    pageSize: ORDER_PAGE_SIZE,
    valuesMasked,
  }), [page, query, side, snapshot.openOrders, sort, status, valuesMasked]);
  const statusTabs = ['all', 'pending', 'filled', 'rejected', 'cancelled', 'other'];

  useEffect(() => {
    if (!exportStatus) return undefined;
    const timer = window.setTimeout(() => setExportStatus(''), 4_000);
    return () => window.clearTimeout(timer);
  }, [exportStatus]);

  const changeAndResetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const selectStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setSide('all');
    setPage(1);
  };
  const exportOrders = (format) => {
    if (!workspace.allOrders.length) return;
    const file = createOrdersExport({
      orders: workspace.allOrders,
      generatedAt: snapshot.generatedAt,
      format,
      valuesMasked,
      labels: {
        symbol: t.symbol,
        side: t.orderSide,
        quantity: t.qty,
        type: t.orderType,
        orderClass: t.orderClass,
        status: t.orderStatus,
        category: t.orderStatusCategory,
        takeProfit: t.takeProfit,
        stopLoss: t.stopLoss,
        observedAt: t.orderObservedAt,
        masked: t.masked,
        yes: t.yes,
        no: t.no,
        statusGroups: t.orderStatusGroups,
      },
    });
    const snapshotDate = String(snapshot.generatedAt || '').slice(0, 10) || 'snapshot';
    const filename = downloadClientFile(file, `orders-${snapshotDate}.${file.extension}`);
    setExportStatus(`${t.exportReady}: ${filename}`);
  };
  const hasFilters = Boolean(query || status !== 'all' || side !== 'all');
  const start = workspace.totalCount ? ((workspace.page - 1) * ORDER_PAGE_SIZE) + 1 : 0;
  const end = Math.min(workspace.page * ORDER_PAGE_SIZE, workspace.totalCount);

  return (
    <div className="page-stack orders-workspace" data-testid="page-orders">
      <section className="order-snapshot-scope" aria-label={t.orderSnapshotScopeTitle}>
        <div className="order-scope-icon"><ShieldAlert aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">{t.orderSnapshotScopeEyebrow}</p>
          <h2>{t.orderSnapshotScopeTitle}</h2>
          <p>{t.orderSnapshotScopeDescription}</p>
        </div>
        <span className="status good">{t.managerOnly}</span>
      </section>

      <section className="order-summary-grid" aria-label={t.orderSummary}>
        {statusTabs.map((group) => {
          const Icon = group === 'all' ? ListOrdered : STATUS_ICONS[group];
          return (
            <article key={group} className={`order-summary-card ${group}`}>
              <Icon aria-hidden="true" />
              <div>
                <span>{t.orderStatusGroups[group]}</span>
                <strong>{workspace.counts[group]}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel orders-toolbar" aria-label={t.orderTools}>
        <div className="order-status-tabs" role="group" aria-label={t.orderStatusFilter}>
          {statusTabs.map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={status === group}
              className={status === group ? 'active' : ''}
              onClick={() => selectStatus(group)}
            >
              <span>{t.orderStatusGroups[group]}</span>
              <strong>{workspace.counts[group]}</strong>
            </button>
          ))}
        </div>

        <label className="orders-search">
          <span className="sr-only">{t.searchOrders}</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={changeAndResetPage(setQuery)}
            placeholder={t.searchOrdersPlaceholder}
            aria-label={t.searchOrders}
          />
        </label>
        <label className="orders-select">
          <span>{t.orderSide}</span>
          <select value={side} onChange={changeAndResetPage(setSide)}>
            <option value="all">{t.allOrderSides}</option>
            {workspace.sides.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <label className="orders-select">
          <span>{t.sortOrders}</span>
          <select value={sort} onChange={changeAndResetPage(setSort)}>
            <option value="status">{t.sortOrderStatus}</option>
            <option value="symbol">{t.sortSymbolAsc}</option>
            <option value="side">{t.sortOrderSide}</option>
          </select>
        </label>
        <div className="orders-export-actions" role="group" aria-label={t.exportOrders}>
          <button type="button" onClick={() => exportOrders('csv')} disabled={!workspace.totalCount}>
            <Download aria-hidden="true" /><span>{t.exportCsv}</span>
          </button>
          <button type="button" onClick={() => exportOrders('excel')} disabled={!workspace.totalCount}>
            <FileSpreadsheet aria-hidden="true" /><span>{t.exportExcel}</span>
          </button>
        </div>
      </section>

      <div className="orders-result-summary" aria-live="polite">
        <span>{t.showingOrders} {start}–{end} {t.of} {workspace.totalCount}</span>
        {hasFilters ? <button type="button" onClick={clearFilters}>{t.clearFilters}</button> : null}
      </div>

      <section className="panel order-list-panel" aria-labelledby="order-list-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.orderBookEyebrow}</p>
            <h2 id="order-list-heading">{t.orderBook}</h2>
          </div>
          <span className="pill">{workspace.totalCount} {t.orderRecords}</span>
        </div>
        {workspace.orders.length ? (
          <>
            <OrderTable orders={workspace.orders} generatedAt={snapshot.generatedAt} language={language} t={t} />
            <OrderCards orders={workspace.orders} generatedAt={snapshot.generatedAt} language={language} t={t} />
          </>
        ) : (
          <EmptyState
            icon={ArchiveX}
            title={snapshot.openOrders.length ? t.noOrderMatches : t.noOrdersTitle}
            description={snapshot.openOrders.length ? t.noOrderMatchesDescription : t.orderSnapshotEmptyDescription}
            testId="order-management-empty-state"
          />
        )}
        {workspace.pageCount > 1 ? (
          <nav className="orders-pagination" aria-label={t.orderPagination}>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={workspace.page === 1}>
              {t.previous}
            </button>
            <span>{t.page} {workspace.page} {t.of} {workspace.pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(workspace.pageCount, current + 1))} disabled={workspace.page === workspace.pageCount}>
              {t.next}
            </button>
          </nav>
        ) : null}
      </section>

      <OrderTimeline orders={workspace.allOrders} generatedAt={snapshot.generatedAt} language={language} t={t} />
      {exportStatus ? <div className="portfolio-toast" role="status">{exportStatus}</div> : null}
    </div>
  );
}
