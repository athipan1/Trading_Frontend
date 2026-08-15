export const PAGE_PATHS = Object.freeze({
  overview: '/overview',
  portfolio: '/portfolio',
  orders: '/orders',
  agents: '/agents',
  'agent-guide': '/agent-guide',
  risk: '/risk',
  backtest: '/backtest',
  system: '/system',
  settings: '/settings',
  ledger: '/ledger',
  advisor: '/advisor',
  investment: '/investment',
});

export const MANAGER_CONTROL_PAGES = Object.freeze(['ledger', 'advisor', 'investment']);

export function pageFromPath(pathname, defaultPage = 'overview') {
  const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (normalized === '/') return PAGE_PATHS[defaultPage] ? defaultPage : 'overview';
  return Object.entries(PAGE_PATHS).find(([, path]) => path === normalized)?.[0] || 'overview';
}

export function pathForPage(page) {
  return PAGE_PATHS[page] ?? PAGE_PATHS.overview;
}

export function isManagerControlPage(page) {
  return MANAGER_CONTROL_PAGES.includes(page);
}
